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

`POST /api/v1/ask` (`api/api.py`, orchestration in `core/services/ask.py`).
Streams over SSE, token by token. The full path:

```text
question
   │
   ├─ length cap (500 chars) · daily quota reserved atomically
   │
   ├─ embed query ──────────────────► 384d vector
   │
   ├─ semantic answer cache lookup ──► HIT (≥0.95 similarity, same scope) → done (~0.2s)
   │                                   MISS ↓
   ├─ story scope set? ── yes ──► that story's whole cluster first, + 2 neighbours
   │                      no
   ├─ pgvector: 40 nearest ARTICLES, auto-publish sources only
   │
   ├─ group into stories · rerank · keep top 4
   │
   ├─ build context: [n]-numbered stories, headlines, one lede per outlet,
   │                 corroboration level, age
   │
   ├─ metadata event: citation table (slug, title, outlet count) — before any text
   │
   ├─ provider configured? ── no ──► extractive answer, same [n] citations
   │                          yes
   │                           ↓
   └─ open stream (fallback chain up to FIRST token) ── fails ──► extractive
                               ok
                                ↓
            relay tokens · cache complete answers · flag truncated ones
```

### Why it streams now, and why it did not before

The endpoint always used an SSE content type, and never streamed. Two
independent causes:

1. It called the blocking `generate()` and emitted the finished answer as one
   event, so the reader watched a spinner for the whole generation.
2. It returned a *sync* generator from a view served under ASGI. Django cannot
   iterate a sync generator on the event loop, so it reads the whole thing into
   a list first and sends that — even a token-level generator would have arrived
   in one piece.

`core/services/ask.py` fixes both: the provider's `stream()` yields tokens, and
an async generator pulls each one through `sync_to_async`. The response also
sets `X-Accel-Buffering: no` so a buffering proxy does not undo it in transit.

The fallback chain applies **up to the first token**. A model that fails to
open costs one round trip and the next model answers; once text has reached the
reader, switching model would splice two different answers together, so a
mid-stream failure keeps what arrived, emits `truncated`, and is not cached.

### Citations

Context stories are numbered `[1]`…`[4]` and the model is told to cite every
factual sentence with those numbers and never invent one. The first SSE event
carries the citation table — slug, title, independent outlet count — so the
client renders each `[n]` as a chip linking to the story, with its
corroboration beside it. A number that resolves to no citation is dropped
rather than rendered as a dead link. The extractive answer uses the same
markers, so both paths look alike to the reader.

### Conversations

Ask keeps a thread. A follow-up is sent with up to three earlier turns
(`history: [{q, a}]`, validated and length-capped server-side), and two things
change:

- **Retrieval embeds the previous question with the new one.** "What did they
  say in response?" carries no topic of its own; embedded alone it retrieves
  nothing useful. Embedded with the question before it, it finds the story.
- **The model sees the conversation — as data.** Prior turns are fenced in a
  `CONVERSATION SO FAR` block; earlier questions are the reader's words and are
  treated exactly like the current one. The system prompt says the thread may
  only be used to understand what the reader means: every fact must still come
  from the retrieved context, with citations.

Follow-ups bypass the semantic cache in both directions — the same words mean
different things in different conversations.

### Asking about one story

`{"query": …, "story": "<slug>"}` scopes retrieval: the story's whole cluster
(up to 10 outlets' headlines and ledes) is always `[1]`, followed by two
nearby stories so "is this connected to X?" can be answered. Cached answers
are keyed by scope as well as embedding — "what happens next?" about two
different stories is the same vector and must not share an answer.

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

Instructions and data travel in different **roles**: the rules are the system
message; the reader's question and the retrieved reporting are the user
message. Both of those are text other people wrote — the reader, and every
publisher whose excerpt reaches the context — so the system message says so,
in a channel neither can write to. The question is additionally delimited
(`<<<…>>>`), and briefs fence the reporting between `<<<REPORTING` markers.

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

The model is asked for strict JSON, with JSON mode requested where the server
supports it (a server that rejects `response_format` is retried without it):

| Field | Purpose |
| --- | --- |
| `consensus_lead` | Two-sentence summary of confirmed facts. Promoted to `Story.summary`. |
| `outlet_claims` | Per-outlet claim or angle. |
| `discrepancies` | Explicit factual, numerical or timeline contradictions between outlets. |
| `open_questions` | Up to three things the coverage explicitly leaves unresolved. |
| `primary_alignment` | How coverage aligns with official primary sources, where one exists. |

Primary sources (government and official documents) are separated in the context
so the model can distinguish reporting *about* a document from the document
itself.

The context carries **one article per publisher** (the earliest), capped at 16
outlets. Sending every article let one newsroom's twelve revisions fill the
context and invited the model to report a publisher agreeing with itself.

### Brief fields added for the story page

| Field | Rendered as | Validation |
| --- | --- | --- |
| `key_facts` | "What the reporting establishes" — each fact with the outlets stating it | Outlets not in the cluster are removed; a fact left with none is dropped; sorted by number of outlets |
| `timeline` | "How it unfolded" — dated developments | Needs a stated time, an event and a known outlet |
| `suggested_questions` | Chips that open a story-scoped Ask | Capped at three, normalised to end in "?" |

### Validation — refusing what cannot be true

`validate_brief()` (`core/services/synthesis.py`) runs on every model brief:

- **A claim attributed to an outlet outside the cluster is dropped.** Models
  write "Reuters reports" because that is what a news sentence sounds like, for
  clusters Reuters never touched. On a product whose claim is *who reported
  what*, a fabricated attribution is the worst available error.
- **`primary_alignment` is blanked when no primary document was in context** —
  any alignment analysis would be invented.
- Lists are type-checked and capped; a brief with no `consensus_lead` is
  rejected and the extractive brief is used instead.

The extractive brief no longer claims "Primary document verification active" —
it verified nothing, so it now says nothing.

`discrepancies` is the field worth understanding: where outlets disagree on a
number or a timeline, the brief surfaces the disagreement rather than silently
picking one. Corroboration counting says how many outlets agree; this says where
they do not.

Synthesis is bounded by `MAX_SYNTHESIS_DAILY_REQUESTS`, holds a Redis lock per
story, and marks `synthesis_status = FAILED` on budget exhaustion rather than
retrying into the ceiling.

---

## 5b. The Briefing

`GET /api/v1/briefing` (`core/services/briefing.py`), rendered at `/briefing`.

- **Only corroborated stories.** Stories first seen in the last 24 hours with
  at least two independent outlets, ordered by outlet count. A quiet day widens
  the window to 72 hours rather than publishing a two-item briefing, and the
  payload says which window was used.
- **Cited like Ask.** Stories are numbered; the overview cites them as `[n]`
  and one line summarises each. Citations to numbers that do not exist are
  removed. A story the model skips keeps its extractive line.
- **Keyless fallback.** The overview is built from the counts and each line
  from the story's own summary — with a headline repeated at the start
  stripped, and video-playlist debris ("03:18 UP NEXT…") replaced by a plain
  statement of who carried the story.
- **Cost.** Cached per hour *and* per story set, warmed at :02 past each hour
  by Celery beat and at the end of `run_pipeline`, and bounded by its own
  daily ceiling (48).
- **What to watch.** The three fastest-moving stories not already included,
  from the momentum column — no model involved.

## 6. Providers, and why keyless is a first-class mode

`LLM_PROVIDER` selects an adapter (`core/services/llm.py`). Presets supply base
URL, model and a fallback chain, so provider + key is a complete configuration:
`groq` · `cerebras` · `openrouter` · `gemini` · `openai` · `ollama` · `none`.

| Preset | Chain (Sept 2026) |
| --- | --- |
| `groq` | `openai/gpt-oss-120b` → `openai/gpt-oss-20b` |
| `cerebras` | `gpt-oss-120b` → `qwen-3.8-27b` |
| `openrouter` | `google/gemma-4-31b-it:free` → `qwen/qwen3.8-27b:free` → `openrouter/free` |

Groq retired `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` on
2026-08-16, and Cerebras and OpenRouter's free tier dropped their Llama ids in
the same window — every call 404'd while the key looked fine. A test now pins
that no preset points at a retired Llama id.

### Reasoning models

The gpt-oss replacements are reasoning models: they think before answering, and
the thinking is billed against the same completion cap. Sent the old cap
unchanged, a hard question could spend it all on reasoning and return an empty
message. `ModelProfile` handles this per model: reasoning effort pinned `low`
(this is summarisation over supplied context, not a maths problem), reasoning
excluded from the payload, and headroom added to the cap so the visible answer
keeps the budget the call site asked for. Vendor spellings differ (Groq's
`include_reasoning`, OpenRouter's `reasoning.exclude`), so the profile is keyed
on the preset as well as the model. An empty response with
`finish_reason=length` is logged as *budget exhausted*, not as a broken key.

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
| Ask response cap | `500` tokens (+768 headroom for reasoning models) | `core/services/ask.py`, `core/services/llm.py` |
| Excerpt per outlet in Ask context | `280` chars | `core/services/retrieval.py` |
| Scoped-story headlines | `10` | `core/services/retrieval.py` |
| Outlets per brief | `16`, one article each | `core/services/synthesis.py` |
| Brief response cap | `1600` tokens | `core/services/synthesis.py` |
| Conversation history | `3` turns, answers trimmed to `600` chars in prompt | `core/services/ask.py` |
| Briefing | `7` stories, `24h` window (`72h` fallback), `900` tokens, `48`/day | `core/services/briefing.py` |
| Brief response cap | `1200` tokens | `core/services/synthesis.py` |
| Resynthesis trigger | `+2` independent outlets | `core/clustering.py` |
| Resynthesis cooldown | `20` minutes | `core/clustering.py` |
| Ask daily ceiling | `500` (`MAX_ASK_DAILY_REQUESTS`) | `api/api.py` |
| Synthesis daily ceiling | `200` (`MAX_SYNTHESIS_DAILY_REQUESTS`) | `core/tasks.py` |

Calibration constants are guarded by tests asserting the *property* — that the
threshold separates the labelled classes — rather than a hardcoded number, so
retuning past what the data supports fails CI. Re-derive with
`manage.py calibrate_threshold`, `calibrate_topics` and `benchmark_embeddings`.
