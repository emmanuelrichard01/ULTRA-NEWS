# System Architecture

> Reflects `main` HEAD. Where a constant was chosen by measurement, the command
> that produced the number is named — re-run it rather than trusting this file.

## 1. The bet

A **Story** — a real-world event — is the primary entity, not an Article. When
several outlets cover one event, their articles cluster into a single Story with
explicit corroboration tracking.

The number that matters is **independent publishers**, not articles. One newsroom
filing five updates is one source; two RSS feeds from one publisher count once. A
newsroom cannot corroborate itself, and every design decision below follows from
that.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  INGESTION                          Celery Beat, every 15 min        │
│                                                                      │
│  known URLs ──┐                                                      │
│               ▼                                                      │
│  conditional GET (ETag / If-Modified-Since)                          │
│      │  304 → success, no body transferred                           │
│      │  4xx/5xx/unparseable → FAILURE (recorded, circuit breaker)    │
│      ▼                                                               │
│  feedparser → deep-fetch ONLY new URLs (8 concurrent, capped at 25)  │
│      ▼                                                               │
│  strip tags→whitespace · strip publisher furniture · nh3 sanitise    │
│      ▼                                                               │
│  Article rows (story = NULL)                                         │
└──────────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────────┐
│  CLUSTERING                         Celery Beat, every 3 min         │
│  Redis-locked, sequential, batched at 500                            │
│                                                                      │
│  embed(title + excerpt) → bge-small-en-v1.5, 384d, local             │
│      ▼                                                               │
│  pgvector ANN shortlist (HNSW, ≤25 candidates, 7-day window)         │
│      ▼   distance comes FROM the query — never recomputed in Python  │
│  cosine ≥ 0.80 → join cluster    else → new Story                    │
│      ▼                                                               │
│  recount publishers · tier · velocity · centroid · topics            │
│      ▼                                                               │
│  invalidate story cache · bump feed generation · publish to ticker   │
│      ▼                                                               │
│  synthesis queued IF +2 new independent outlets AND 20min cooldown   │
└──────────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────────┐
│  SERVING                                                             │
│  Next.js 16 (RSC)  ←  Django Ninja  ←  PostgreSQL 16 + pgvector      │
│                            ↑ generation-keyed feed cache (Redis)     │
│                            ↑ semantic answer cache                   │
│                            ↑ /metrics (Prometheus)                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Stack

| Component | Technology | Why |
| --- | --- | --- |
| API | Django + Django Ninja | Typed schemas, auto-docs, lighter than DRF here |
| Database | PostgreSQL 16 + pgvector | Vector search without a second datastore |
| Cache / broker | Redis 7 | API cache, Celery broker, ticker, rate limits |
| Tasks | Celery + beat | Three queues: `fetch`, `cluster`, `celery` |
| Embeddings | `bge-small-en-v1.5` (384d), local | No per-article API cost |
| LLM | Pluggable (Gemini / OpenAI-compatible / **none**) | Keyless is a supported mode |
| Frontend | Next.js 16 App Router | Server components; tag-based revalidation |

---

## 2. Corroboration — the core model

`Story.independent_count` counts **distinct publishers**, resolved from the feed
URL through the Public Suffix List (`tldextract`), with an optional explicit
override in the source registry for feeds served by a syndication host.

Dot-counting was tried and abandoned: it reduced `theeastafrican.co.ke` to
`co.ke`, which would have made every Kenyan outlet one publisher.

| Independent publishers | Meaning |
| --- | --- |
| 1 | Single source, unconfirmed |
| 2 | One independent confirmation |
| 3+ | Corroborated |

### Editions

Each is an **ordering of the whole corpus**, not a subset — so none runs dry.

| Edition | Ordering | Paginates? |
| --- | --- | --- |
| The Wire | `-first_seen_at, -id` | Yes — the key is immutable |
| Developing | Distinct publishers whose article *published* in the last 12h | No — capped snapshot |
| The Record | `-independent_count, -source_count` | No — capped snapshot |

Only immutable keys can paginate. Ranking scores are rewritten by clustering, so
paging them would repeat and drop rows as they cross the cursor boundary.

Momentum keys on `published_date`, **not** `created_at`. `created_at` is when we
scraped, so on a fresh database it made every article look newly arrived and
collapsed Developing into The Record.

---

## 3. Clustering

**Threshold: cosine ≥ 0.80.** Set by `manage.py calibrate_threshold` against a
live corpus, not by taste. Measured distribution:

| Class | Scores |
| --- | --- |
| Same event, wire syndication | 0.806, 0.931, 0.960 |
| Same event, heavy paraphrase | 0.727, 0.766 |
| Different event, same topic | 0.402, 0.573, 0.583, **0.730** |

**These classes overlap.** An unrelated AI-opinion pair scores 0.730; a genuine
paraphrase scores 0.727. No threshold separates them, so the choice is which
error to make — and for a verification product a false merge is far worse than a
missed one. At 0.68 the largest cluster on real data reached 112 articles of
unrelated geopolitics.

**Known recall gap:** vocabulary-divergent paraphrases ("CBN" vs "Apex Bank")
stay unclustered. `manage.py benchmark_embeddings` shows 768d and 1024d models
score *worse* separation, so this is not fixed by a bigger model — it needs
entity-aware matching, deliberately deferred.

**Centroid** updates as a running mean, normalised. Safe at 0.80; catastrophic
below it (largest cluster 112 vs 13 without).

---

## 4. Topics

Semantic, not keyword. Keyword matching left **47%** of a 619-article corpus
untagged, put 2 articles in "art", and filed "Hong Kong can look to San
Francisco" under Technology.

Each topic is embedded from several natural-language prototypes; articles are
matched by argmax. The gate is **distinctiveness** (`top-1 − mean(rest)`), not
absolute score — measured on real data:

| | top-1 absolute | top-1 − mean |
| --- | --- | --- |
| Real headlines | 0.474 – 0.735 | **0.059 – 0.157** |
| Filler / boilerplate | 0.584 – 0.688 | **0.020 – 0.048** |

The absolute ranges overlap completely (`"..."` scores 0.688, higher than a real
story at 0.474), which is why an absolute floor classified gibberish as
Technology. Coverage went 53% → **98%**. Calibrate with
`manage.py calibrate_topics`.

---

## 5. Source health

A fetch failure must be distinguishable from a quiet feed. Conflating them left
four dead feeds — including both Tier-1 wire services — reporting healthy
indefinitely.

- `FeedFetchError` / `FeedNotModified` / success are distinct outcomes
- `last_success_at` is tracked separately from `last_fetched_at`
- Transient transport errors (DNS, timeouts) **retry** with jittered backoff —
  a resolver blip under 41-way fan-out is our fault, not the publisher's
- Circuit breaker deactivates a source after 12 consecutive failures
- `manage.py validate_sources --fail-fast` checks the registry in CI

---

## 6. AI

**Retrieval is story-level.** Article-level retrieval let one heavily-covered
event fill every context slot. Now: over-fetch 40 articles → group into stories →
rerank on similarity + corroboration + recency.

Corroboration reaches the prompt, so answers can say "6 independent outlets
corroborate" versus "SINGLE SOURCE — not independently confirmed".

**Semantic answer cache** keyed on the query embedding, because "gaza latest"
and "what's happening in Gaza" are one question with no shared string key.
Invalidated by a generation counter that ingestion bumps — a stale answer is
worse than a slow one.

| | Latency |
| --- | --- |
| Cache hit | ~0.2s |
| Fresh generation | 9–11s |

**Provider is pluggable and optional.** With none configured, briefs and answers
are assembled from source text. Model failure degrades to the same path rather
than dead-ending — retrieval has already succeeded by then.

The embedding model is **warmed at process start** (`config/asgi.py`). Loading it
lazily cost 11.5s on the first request, including on a cache hit, since the query
must be embedded before the cache can be consulted.

---

## 7. Caching

| Layer | Key | Invalidation |
| --- | --- | --- |
| Feed responses | generation + filters + cursor | Generation bump on ingest |
| Story detail | `story:{slug}` | Explicit, on cluster change and synthesis |
| Answers | Query embedding ≥ 0.95 similarity | Generation bump |
| Counts | Filter tuple | 60s TTL |

Invalidation is **explicit**, never a `post_save` signal. The previous signal
fired on every Story write — including bulk velocity updates — and issued a
blocking outbound HTTP request each time, inside the clustering transaction.

---

## 8. Performance

Measured warm, on the live stack:

| Endpoint | Before | After |
| --- | --- | --- |
| `/stories` (Wire) | 472ms | **82ms** |
| `/stories?sort=momentum` | 1442ms | **89ms** |
| `/stories?sort=significance` | 781ms | **88ms** |

The fix was removing a prefetch that hydrated every publishable article of every
story — with `Source` joined — to use three of them, when both counts are already
denormalised on the Story row. Cost grew with cluster size, so the best-covered
stories were the most expensive to list.

**Indexes:** HNSW on `Story.embedding` and `Article.embedding`
(`vector_cosine_ops`); composite on `(independent_count, -first_seen_at, -id)`
for the corroboration filter; `(-created_at, story)` for momentum; GIN on
`search_vector`, maintained by a **database trigger** so it cannot drift from the
row whichever path writes it.

---

## 9. Retention

Measured ~9.2 KB/article and ~3.7 KB/raw document — about 3.3 GB/year at 1,000
articles/day. Tiered, because parts of a row have different useful lifetimes:

| Data | Default | Why |
| --- | --- | --- |
| `RawDocument` | 14 days | Only needed to embed and synthesise, both within hours |
| `Article.content` + `embedding` | 45 days | Clustering only looks back 7 days; the row survives |
| Uncorroborated stories | 90 days | ~95% of rows; the only outright deletion |
| Corroborated stories | Kept | The archive worth having |

`RETENTION_ENABLED=0` keeps everything. Inspect with `manage.py retention`.

---

## 10. Observability

`/metrics` (Prometheus, access-controlled) and `/api/v1/health` (503 when
degraded, so uptime checks work without parsing a body).

The signal to alert on is **`ultranews_articles_pending_clustering`**. An article
that is never clustered is invisible to every reader while every request still
returns 200 — no request-level metric reveals it.

Endpoint labels use the **route pattern**, never the raw path: labelling by path
would mint a series per story slug and eventually take the metrics endpoint down
by cardinality.

Every response carries `X-Request-ID`, bound into structlog context. Under
`gunicorn --workers N`, set `PROMETHEUS_MULTIPROC_DIR` or a scrape returns
whichever worker answered it.

---

## 11. Security

| Control | Note |
| --- | --- |
| `SECRET_KEY` | Refuses to start when `DEBUG=0` and unset |
| Rate limiting | Keys on `REMOTE_ADDR` unless `TRUST_PROXY_HEADERS`; atomic `add`+`incr` |
| OIDC | Requires `GITHUB_OIDC_REPOSITORY` — a valid Actions token only proves it came from GitHub, not from *your* workflow |
| Admin key | Constant-time compare |
| Containers | Non-root (`appuser` / `nextjs`) |
| LLM errors | Logged, never returned — SDK errors embed URLs and key fragments |
| Prompt injection | Reader question delimited and labelled as data |
| Images | Host allowlist; `**` would make the deploy an open image proxy |
| SSE | Lifetime-bounded, connection-capped, CORS via allowlist |

---

## 12. Testing

104 tests. Migrations **must** run — parts of the schema exist only as
migrations (`0006` pgvector, `0013` the search trigger), so `--nomigrations`
made the suite unbuildable.

Calibration constants are guarded by tests that assert the *property* — that the
threshold separates the labelled classes — rather than a hardcoded number, so
retuning past what the data supports fails CI.
