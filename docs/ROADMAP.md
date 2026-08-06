# Roadmap

> Living document. Records what is done, what is deliberately not done, and why.

---

## Done

### Correctness

Several headline features had been shipping in a **completely non-functional**
state, with nothing surfacing the failure:

- [x] **Article embeddings were never persisted.** Computed, then saved with
      `update_fields=['story']`. Every `Article.embedding` was NULL, which
      silently reduced `/ask` to matching nothing.
- [x] **Full-text search never worked.** `search_vector` had a GIN index and no
      writer. Now maintained by a database trigger so it cannot drift.
- [x] **The breaking ticker could never emit.** It cursored on `Story.id` but
      filtered to promoted tiers — and promotion doesn't change the id.
- [x] **The Ask modal parsed nothing.** Split SSE on `'\\n'`, a literal
      backslash-n.
- [x] **`core/signals.py` was never loaded.** `ready()` was `pass`, so
      `is_primary_source` stayed False and the trust graph read zero forever.
- [x] **"Synthesize Evolution" 404'd** on a relative path that doesn't exist on
      the Next origin.
- [x] **Text extraction fused words across block boundaries**
      (`saysPublished August 4`), corrupting excerpts *and* the embeddings built
      from them.

### Clustering & topics

- [x] Threshold calibrated by measurement (`manage.py calibrate_threshold`)
- [x] pgvector ANN with HNSW indexes; distance reused from the query rather than
      recomputed in Python
- [x] Publisher identity via the Public Suffix List — feed URLs counted two BBC
      feeds as two independent corroborations
- [x] Moving centroid, safe at the calibrated threshold
- [x] Topics replaced keyword matching with semantic classification: 47%
      untagged → 2%

### Sources

- [x] Fetch failures distinguished from quiet feeds (four dead feeds, including
      both Tier-1 wires, had reported healthy indefinitely)
- [x] Circuit breaker, `last_success_at`, `last_error`
- [x] Conditional GET (ETag / If-Modified-Since)
- [x] Transient transport errors retried rather than blamed on the publisher
- [x] `manage.py validate_sources` — registry now 41/41 healthy

### Product

- [x] Three editions (The Wire / Developing / The Record), each an ordering of
      the whole corpus so none runs dry
- [x] Corroboration as a filter and a per-card signal
- [x] Story page rebuilt: verification statement, conflicts-first brief,
      corroboration timeline, pickup-pattern chart, framing matrix, source ledger
- [x] Outbound RSS per edition (previously advertised, previously 404)
- [x] Every page rebuilt on a real token system; `not-found`, error and loading
      states; skip link

### AI

- [x] Story-level retrieval reranked on similarity + corroboration + recency
- [x] Corroboration reaches the prompt
- [x] Semantic answer cache — 11.9s → 0.2s on a paraphrase
- [x] Incremental synthesis gated on *new independent outlets* + cooldown
- [x] Pluggable provider; **keyless is a first-class mode**
- [x] Model failure degrades to source-derived output

### Platform

- [x] Security: OIDC repo pinning, non-forgeable rate limiting, `SECRET_KEY`
      hard-fail, non-root containers, no error leakage
- [x] Ingestion rewritten — dedupe before deep-fetch, concurrency, honest limits
- [x] Feed latency 472/1442/781ms → 82/89/88ms
- [x] Generation-keyed feed cache; ticker moved off Postgres to Redis
- [x] Tiered retention (~3.3 GB/year measured)
- [x] Observability: Prometheus metrics, request correlation, optional Sentry
- [x] CI actually runs the tests — it previously ran only `ruff`, so the suite
      had been unbuildable and unnoticed

---

## Deliberately not done

**Entity-aware matching.** Would fix one of six benchmark pairs (the "Sam Altman
⇒ OpenAI" case). Needs an NER model plus a maintained alias knowledge base, and
entity overlap is a noisy signal — "Trump" appears across hundreds of unrelated
stories — so used as a recall booster it risks false merges, the failure mode
that damages this product most. If done, it should be a precision-preserving
reranker consulted only in a 0.70–0.80 near-miss band.

**A larger embedding model.** Benchmarked (`manage.py benchmark_embeddings`):
768d and 1024d models scored **worse** class separation than the current 384d
model. Bigger is not better here.

**Email digests.** The subscribe page previously faked success on a form that
posted nowhere. Replaced with real RSS rather than collecting addresses for
something that doesn't exist.

---

## Next

| | Why |
| --- | --- |
| Materialise the momentum counter | The slowest remaining query — a filtered `COUNT(DISTINCT)` grouped across articles, recomputed per request |
| pgbouncer in compose | Settings support it; no bundled deployment yet |
| Grafana dashboard | Metrics exist; nothing renders them |
| Story merge / split | Clustering errs toward under-merging, so duplicates need a manual remedy |
| Publisher ownership graph | Independence is inferred from domains, so outlets under common ownership count separately |
