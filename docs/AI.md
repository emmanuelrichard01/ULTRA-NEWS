# How the AI Works

> Reflects `main` HEAD. Every constant below is named with the file it lives in —
> read the source rather than trusting this file if the two disagree.
>
> For the surrounding system see [ARCHITECTURE.md](ARCHITECTURE.md); this
> document covers only the machine-learning and model-facing parts of it.

## 1. Scope — what the AI does, and what it does not

Ultra News uses machine learning for two distinct jobs, and it is worth
separating them because they carry very different risk:

| Job | Technique | Runs | Failure mode |
| --- | --- | --- | --- |
| Deciding which articles describe the **same event** | Sentence embeddings, no LLM | Always, locally | Split or merged clusters |
| Writing **prose** — story briefs and answers | LLM, pluggable | Optional | Degrades to extractive text |

The first is load-bearing. It produces the corroboration count, which is the
product's entire claim. It involves no language model, no API call and no
generated text — it is vector arithmetic over a local model.

The second is a presentation layer over work that has already succeeded. It can
be switched off entirely and the site still functions.

Three properties follow, and all three are worth stating plainly because readers
assume the opposite:

- **Nothing browses the web at question time.** Retrieval searches the corpus
  already ingested on a schedule. A question cannot pull in a page the crawler
  has not already stored.
- **No model judges whether a claim is true.** The system counts independent
  publishers and reports the number. A widely-repeated falsehood will show a high
  count. This measures *agreement*, not truth, and the interface says so.
- **The corroboration number is never generated.** It is a database aggregate
  (`Story.independent_count`). A model is shown that number; no model produces
  it, and no model can alter it.

---

## 2. Embeddings — the part that matters

**Model:** `BAAI/bge-small-en-v1.5`, 384 dimensions, run locally through
`fastembed`. No API, no per-article cost, no data leaving the host.

An embedding maps text to a vector positioned by meaning, so *"Storm forces
airport closures"* and *"Flights grounded as storm hits"* land close together
despite sharing almost no vocabulary. Cosine distance between two such vectors is
the similarity signal the whole pipeline rests on.

The same model serves three call sites, which is why it is worth loading once:

1. **Clustering** — embed `title + excerpt`, match against existing stories.
2. **Topics** — match articles against embedded topic prototypes
   (see ARCHITECTURE.md §4).
3. **Ask** — embed the reader's question so it can be compared against articles.

**Bigger is not better here.** `manage.py benchmark_embeddings` compares 768d and
1024d alternatives on labelled same-event pairs; both score *worse* separation
than the 384d model. Model size is not the constraint — see §7.

**Warmed at process start** in `config/asgi.py`. Lazy loading cost 11.5s on the
first request, *including on a cache hit*, because a query must be embedded
before the semantic cache can be consulted. Each Gunicorn worker holds its own
copy: 349 MiB for one, 587 MiB for two. Raise `WEB_CONCURRENCY` only when the
host has the memory.

---

## 3. Clustering — no model writes anything

Full treatment in ARCHITECTURE.md §3. In summary: a pgvector HNSW index returns
a shortlist of nearby stories, each is re-scored exactly, and cosine ≥ **0.80**
joins the cluster. Distinct publishers are then recounted from the database.

The threshold is calibrated by `manage.py calibrate_threshold`, and it is
deliberately set to **under-merge**. Genuine paraphrases and unrelated
same-topic articles overlap in score, so no threshold cleanly separates them;
the only real choice is which error to make. A missed merge shows two
single-source entries. A false merge fabricates corroboration out of unrelated
events — which is the one failure this product cannot absorb.

---

## 4. Ask the Wire Room — retrieval-augmented generation

`POST /api/v1/ask` (`api/api.py`). Streams over SSE. The full path:

```text
question
   │
   ├─ length cap (500 chars) · daily quota reserved atomically
   │
   ├─ embed query ──────────────────► 384d vector
   │
   ├─ semantic answer cache lookup ──► HIT (≥0.95 similarity) → stream, done (~0.2s)
   │                                   MISS ↓
   ├─ pgvector: 40 nearest ARTICLES, auto-publish sources only
   │
   ├─ group into stories · rerank · keep top 4
   │
   ├─ build context: headlines + corroboration level + age
   │
   ├─ provider configured? ── no ──► extractive answer from sources
   │                          yes
   │                           ↓
   └─ LLM (max 450 tokens) ── fails ──► extractive answer from sources
                               ok
                                ↓
                        stream · cache by embedding
```

### Why retrieval is story-level

Article-level retrieval collapsed diversity: a well-covered event has a dozen
near-identical articles, so all context slots filled with one story and
everything else the reader might have meant was crowded out. Retrieval now
over-fetches at article level and groups into stories before ranking.

Only sources at `TrustTier.AUTO_PUBLISH` can ground an answer.

### The rerank

`core/services/retrieval.py`:

| Term | Weight | Shape |
| --- | --- | --- |
| Similarity | `1.0` | Best-matching article represents its story |
| Corroboration | `0.15` | `log1p(n)/log(10)` — diminishing returns |
| Recency | `0.20` | `exp(-age / 36h)` — exponential decay |

Similarity **dominates by design**. Corroboration and recency break ties among
results that are already relevant; they must not drag in a well-corroborated
story that fails to answer the question. Corroboration uses diminishing returns
because the step from one outlet to three is the meaningful one — three to
thirty adds little and should not dominate ranking.

Recency is a *preference*, not a filter. There is no cutoff date on retrieval;
an old story still surfaces if nothing newer matches.

### What reaches the prompt

Corroboration is rendered into the context explicitly, per story — `"6
independent outlets corroborate this"` versus `"SINGLE SOURCE — not
independently confirmed"`. This is the distinction the product exists to draw,
and it can only be drawn if the evidence reaches the model. The prompt then
instructs the model to respect it and to state when something rests on a single
unconfirmed source.

The remaining instructions are equally load-bearing: answer from context only,
attribute claims to the outlets named, note where outlets frame a story
differently, and — critically — **say plainly when the context does not answer
the question rather than speculating**.

That last rule defines the honest boundary of the feature. It can only report
what the newsrooms it follows have published. Asked about something outside that,
the correct behaviour is to say so.

### Prompt injection

The reader's question is delimited (`<<<…>>>`) and labelled as data, with an
explicit instruction never to follow instructions inside it and never to let it
change the rules. Untrusted input sits next to instructions here, so the boundary
is stated rather than implied by position.

### Semantic answer cache

Keyed on the **query embedding**, not the string: *"gaza latest"* and *"what's
happening in Gaza"* are one question with no shared key. A stored answer is
reused above `0.95` similarity (`core/services/answer_cache.py`), and invalidated
by a generation counter that ingestion bumps — a stale answer is worse than a
slow one.

| | Latency |
| --- | --- |
| Cache hit | ~0.2s |
| Fresh generation | 9–11s |

News queries cluster hard around whatever is happening today, so paraphrases of
one question are the common case rather than the exception. The cache is what
makes a free-tier provider viable.

---

## 5. Story briefs — background synthesis

`core/services/synthesis.py`, queued by `core/tasks.py`. A brief is generated
only when the corroboration picture has actually moved: **+2 new independent
outlets** since the last synthesis, and a **20-minute cooldown**. Regenerating on
every cluster change would spend the daily budget on cosmetic updates.

The model is asked for strict JSON:

| Field | Purpose |
| --- | --- |
| `consensus_lead` | Two-sentence summary of confirmed facts. Promoted to `Story.summary`. |
| `outlet_claims` | Per-outlet claim or angle. |
| `discrepancies` | Explicit factual, numerical or timeline contradictions between outlets. |
| `primary_alignment` | How coverage aligns with official primary sources, where one exists. |

Primary sources (government and official documents) are separated in the context
so the model can distinguish reporting *about* a document from the document
itself.

`discrepancies` is the field worth understanding: where outlets disagree on a
number or a timeline, the brief surfaces the disagreement rather than silently
picking one. Corroboration counting says how many outlets agree; this says where
they do not.

Synthesis is bounded by `MAX_SYNTHESIS_DAILY_REQUESTS`, holds a Redis lock per
story, and marks `synthesis_status = FAILED` on budget exhaustion rather than
retrying into the ceiling.

---

## 6. Providers, and why keyless is a first-class mode

`LLM_PROVIDER` selects an adapter (`core/services/llm.py`). Presets supply base
URL, model and a fallback chain, so provider + key is a complete configuration:
`groq` · `cerebras` · `openrouter` · `gemini` · `openai` · `ollama` · `none`.

Fallback chains run strongest-first, largest-daily-allowance-last, so free-tier
quota exhaustion **degrades quality rather than removing the feature**.

The abstraction exists because the previous design hardcoded one vendor at two
call sites, which assumed a single operator with a single key. That is wrong for
a self-hosted project, and it broke outright when `gemini-2.5-flash` began
returning 404 to new keys — a dead constant took the whole feature down.

Hence three rules:

1. **Keyless is a supported mode, not a failure state.** With no provider, briefs
   and answers are assembled from source text. Nothing about Ultra News requires
   paid inference to be useful.
2. **The provider is configuration.** Adding one is a class, not a refactor.
3. **Failure degrades, never dead-ends.** Every call site can fall back, because
   retrieval has already succeeded by the time a model is consulted.

Rule 3 is why `build_extractive_answer` exists. Hosted models return transient
503s; the earlier behaviour displayed *"Synthesis is temporarily unavailable"*
while holding everything needed to answer. The extractive path is the floor the
feature never drops below.

**LLM errors are logged, never returned to the browser** — provider SDK errors
routinely embed request URLs, headers and key fragments.

---

## 7. Known limits

Stated because they are structural, not because they are about to be fixed.

- **Vocabulary-divergent paraphrases stay unclustered.** *"CBN"* and *"Apex
  Bank"* describe one institution; the embedding does not know that. Larger
  models score worse separation, so this needs entity-aware matching, which is
  deliberately deferred. The visible symptom is one event appearing as two
  single-source entries.
- **Corroboration measures agreement, not independence of *sourcing*.** Forty
  outlets running the same wire copy are forty publishers by this metric. Feeds
  from one publisher collapse to one, but shared upstream wire copy does not.
- **The archive bounds every answer.** Retention blanks `Article.embedding` and
  `content` after 45 days (`RETENTION_ARTICLE_PAYLOAD_DAYS`), keeping the row but
  removing it from vector search — retrieval filters on `embedding__isnull=False`.
  Uncorroborated stories are deleted after 90 days. So `/ask` is bounded by what
  the corpus still holds, and the story remains linkable after it stops being
  retrievable. `RETENTION_ENABLED=0` keeps everything.
- **Extractive output is visibly plainer.** The fallback is honest and useful,
  not equivalent. `synthesis_type` in the API response distinguishes `llm` from
  `extractive` so clients can tell.

---

## 8. Constants

| Constant | Value | File |
| --- | --- | --- |
| Embedding model | `bge-small-en-v1.5`, 384d | `core/clustering.py` |
| Cluster threshold | cosine ≥ `0.80` | `core/clustering.py` |
| ANN candidates | `25`, 7-day window | `core/clustering.py` |
| Article fanout | `40` | `core/services/retrieval.py` |
| Stories in context | `4` | `core/services/retrieval.py` |
| Headlines per story | `3` | `core/services/retrieval.py` |
| Recency half-life | `36h` | `core/services/retrieval.py` |
| Rerank weights | `1.0` / `0.15` / `0.20` | `core/services/retrieval.py` |
| Answer cache hit | ≥ `0.95` similarity | `core/services/answer_cache.py` |
| Ask query cap | `500` chars | `api/api.py` |
| Ask response cap | `450` tokens | `api/api.py` |
| Brief response cap | `1200` tokens | `core/services/synthesis.py` |
| Resynthesis trigger | `+2` independent outlets | `core/clustering.py` |
| Resynthesis cooldown | `20` minutes | `core/clustering.py` |
| Ask daily ceiling | `500` (`MAX_ASK_DAILY_REQUESTS`) | `api/api.py` |
| Synthesis daily ceiling | `200` (`MAX_SYNTHESIS_DAILY_REQUESTS`) | `core/tasks.py` |

Calibration constants are guarded by tests asserting the *property* — that the
threshold separates the labelled classes — rather than a hardcoded number, so
retuning past what the data supports fails CI. Re-derive with
`manage.py calibrate_threshold`, `calibrate_topics` and `benchmark_embeddings`.
