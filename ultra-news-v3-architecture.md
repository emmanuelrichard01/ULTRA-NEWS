# 🏗️ System Architecture: ULTRA-NEWS V3

## 0. Why V2 → V3

V2 is a clean, correct "ship it" architecture: Django + Ninja, Next.js, Postgres, Celery. It will work. But it has no opinion about the three things that actually differentiate a news aggregator — **deduplication, story clustering, and semantic discovery** — and it treats AI as absent rather than as infrastructure. V3 keeps your stack but adds the ingestion-intelligence and AI-native layers that turn "we display articles" into "we understand the news."

| Gap in V2 | Fix in V3 |
|---|---|
| No dedup → 12 outlets running the same AP wire story show up as 12 separate articles | Content-hash + embedding-based dedup, with a `Story` entity that clusters coverage |
| Offset pagination (`?page=5`) | Cursor pagination — stable under high insert-rate (news never stops publishing) |
| No search beyond Postgres `ILIKE` | Meilisearch/Typesense for fast, typo-tolerant full-text + filtered search |
| Scraping = single Celery task with bespoke per-source rules | A proper, idempotent, retryable pipeline: fetch → extract → normalize → dedup → enrich → persist → index → notify |
| Time-based ISR (`revalidate: 60`) | Event-driven on-demand revalidation — a breaking story is live in seconds, not next polling cycle |
| No observability | OpenTelemetry + Prometheus/Grafana + Sentry from day one |
| "AI" absent | AI as infrastructure: summarization, semantic clustering, personalization — all async, cached, cost-controlled |

> **Before building**: §13 flags gaps that weren't in the original brief but matter more than most of what's above — legal exposure from storing scraped full-text chief among them. Read that section before you write the `Article` model.

---

## 1. Updated Tech Stack

| Layer | V2 | V3 | Why |
|---|---|---|---|
| Backend framework | Django 5.x + Ninja | **Django 6.x + Ninja**, ASGI | Django 6 carries forward the async rollout (async views, async auth/permissions); ORM async is still partial, so async views are used for I/O-bound work while ORM-heavy paths stay sync via `sync_to_async` where needed |
| Frontend | Next.js 14, App Router | **Next.js 16**, App Router, Turbopack | PPR/"Cache Components" went stable in Next.js 16 — static shell + streamed dynamic personalization in one response, which is exactly the SEO-meets-personalization problem a news site has |
| Styling | Tailwind CSS | **Tailwind v4** (Oxide engine) | Faster builds, no real migration cost |
| DB | PostgreSQL 15+ | **PostgreSQL 16/17 + `pgvector`** | Embeddings live next to your relational data — no second database to operate |
| Search | — (none) | **Meilisearch or Typesense** | Sub-50ms typo-tolerant search with near-zero ops overhead; graduate to OpenSearch only if you need heavy aggregation/analytics later |
| Async/queue | Celery + Redis | **Celery + Redis** (kept), pipeline designed to be broker-agnostic | Don't reach for Kafka until throughput actually demands it — see §3 |
| Content extraction | Bespoke per-source scraping rules | **`trafilatura`** for boilerplate-free extraction + raw HTML archived to object storage | Per-source scraping rules rot every time a site redesigns; extraction libraries are maintained for you |
| Observability | — (none) | **OpenTelemetry + Prometheus/Grafana + Sentry** | You can't scale what you can't see |
| IaC | Docker Compose only | **Docker Compose (dev) + Terraform (prod)** | Reproducible environments, no more "works on my docker-compose" |

---

## 2. The Ingestion Pipeline (the part V2 is missing)

This is the highest-leverage addition. Every stage is **idempotent and independently retryable** — that's deliberate, so you can run it on Celery now and move individual stages to Kafka/Redpanda later without rewriting business logic.

```
[Source Registry] → Fetch → Extract → Normalize → Dedup/Cluster → Enrich (AI) → Persist → Index → Notify
```

1. **Fetch** — Celery Beat schedules per-`Source` polling (interval tuned per feed's actual update frequency). Wrap each source call in a circuit breaker (e.g. `pybreaker`) so one dead RSS feed doesn't burn worker time or trigger retry storms.
2. **Extract** — `trafilatura` strips boilerplate/ads/nav from raw HTML. Store the raw HTML in S3/R2 *before* extraction — if your extraction logic improves in six months, you can reprocess history instead of losing it.
3. **Normalize** — canonical schema (title, body, published_at, language via `fasttext` lang-id), and URL canonicalization (strip UTM/tracking params) so dedup keys are actually comparable.
4. **Dedup & Cluster** — two layers:
   - *Exact/near-duplicate*: SimHash on normalized text catches verbatim wire-service republication (AP/Reuters syndication is extremely common).
   - *Story-level clustering*: embed title + lead paragraph, compare against recent `Story` centroids (cosine similarity, rolling 48–72h window). Match → attach to existing Story; no match → spawn a new one. This is what gives you "14 sources covering this story" — the single biggest UX upgrade for a news aggregator.
5. **Enrich** — a separate worker pool calls an LLM/NLP step for categorization, entity extraction, and summarization. Cache by content hash so you never re-pay for unchanged content.
6. **Persist** — write `Article`, update the parent `Story` aggregate (source_count, last_updated_at).
7. **Index** — push to Meilisearch/Typesense, write the embedding to `pgvector`.
8. **Notify** — publish an internal event → triggers Next.js on-demand revalidation + an SSE push for breaking stories. No more waiting on a 60-second ISR timer.

---

## 3. Data Layer (Updated Schema)

New/changed entities relative to V2:

- **`Source`** — `url`, `type` (rss / scrape / api), `scrape_config` (jsonb), `health_status`, `fetch_interval`
- **`RawDocument`** — `source_id`, `url`, `raw_html_ref` (object storage key), `fetched_at` — keep raw content for reprocessing
- **`Story`** *(new)* — represents a real-world event; `title`, `first_seen_at`, `source_count`, `centroid_embedding vector(768)`
- **`Article`** — adds `story_id` (FK, nullable), `embedding vector(768)`, `content_hash`, `summary`, `lang`, `status`
- **`Category`** — taxonomy, optionally hierarchical
- **`Tag`** — free-form, many-to-many with `Article` (more granular than Category)
- **`Author`**, **`Media`** (images/video, CDN URL, alt text)
- **`UserPreference`**, **`ReadHistory`** — feeds personalization later

Performance notes:
- Partition `Article` by `published_at` (monthly range partitions) — keeps queries fast and makes cold-archival of old partitions trivial.
- Add a Postgres **read replica** for the Next.js read path; only ingestion workers write to primary.

---

## 4. API Layer (Django Ninja) Enhancements

- **Cursor pagination** (`?cursor=<opaque>&limit=20`) instead of offset. Offset pagination silently breaks on a feed that's constantly inserting new rows — you get duplicate or skipped articles between page loads. Cursor pagination doesn't have this bug.
- **Versioning from day one**: `/api/v1/...`
- **Async views** for I/O-bound endpoints (calling search/LLM services); keep ORM-heavy CRUD sync given Django's async ORM is still partial.
- **Rate limiting** at the reverse-proxy layer (Traefik/Caddy) rather than in application code — easier to reason about, doesn't cost app CPU.
- **Internal-only webhook**: `POST /internal/events/published` — decoupled trigger for cache invalidation + Next.js revalidation, never exposed publicly.
- **Auth split**: HttpOnly + SameSite=strict session cookie + CSRF for your first-party Next.js client (simpler and safer than JWT-in-localStorage for a server-rendered app); API-key auth reserved for a future public/third-party API product.

---

## 5. AI-Native Features

These are what make the platform feel like 2026 software rather than an RSS reader with a nice UI. All of them are async, cached, and cost-controlled — never inline on the request path.

- **Auto-summarization** — short TL;DR per article, generated once at enrichment time, cached.
- **Story clustering** — "12 sources are covering this" (built in §2/§3).
- **Semantic "related articles"** — `pgvector` similarity search instead of tag-matching.
- **Source credibility/bias signals** — lightweight tagging per source, surfaced as a media-literacy feature, not a hard verdict.
- **Personalized feed** — embed `ReadHistory` into a lightweight user-interest vector, rank candidate articles by similarity. Start with this; it's far cheaper than a full recommender system and gets you 80% of the value.
- **RAG "ask the news"** *(stretch goal)* — chat-style Q&A grounded in your own indexed corpus, not the open web.

---

## 6. Client Layer (Next.js 16) Enhancements

- **Cache Components / PPR** — wrap personalized slots (login state, "for you" rail) in `<Suspense>`; everything else prerenders to a static shell served from the edge. You get SEO-grade TTFB *and* per-user personalization in the same response — no client-side fetch waterfall.
- **On-demand revalidation** — backend calls `revalidateTag`/`revalidatePath` the moment an article finishes enrichment, instead of relying on a timed ISR window.
- **SSE for breaking news** — one-directional push is cheaper and simpler than WebSockets for a live ticker.
- **PWA** — offline article caching + push notification for breaking stories.

---

## 7. Caching Strategy (multi-layer)

1. CDN edge cache (static shell, images via CDN)
2. Next.js Cache Components (per-route, tag-based)
3. Redis (hot API responses — trending lists, category feeds)
4. Postgres query cache where appropriate

Invalidation is **event-driven**, tied to the `Notify` step in §2 — never purely time-based.

---

## 8. Observability & Reliability

- **OpenTelemetry** traces across Django, Celery workers, and Next.js
- **Prometheus + Grafana** — queue depth, per-source scrape success rate, API latency, cache hit ratio
- **Sentry** — error tracking, both backend and frontend
- **Structured logging** (`structlog`) — queryable JSON logs, not grep-only text
- **Reliability patterns**: per-source circuit breakers, dead-letter queue with replay for failed enrichment/scrape tasks, idempotency keys on ingestion so retries never create duplicate articles

---

## 9. Infrastructure & Deployment

- Docker Compose stays for local dev.
- Production: managed containers (ECS/Fargate, or Kubernetes once the team is ready for that overhead; Railway/Render are reasonable if the team is small).
- **Terraform** for IaC — reproducible environments, no drift.
- **GitHub Actions** CI/CD: lint (`ruff`, `mypy`, `eslint`) → test (`pytest`, Playwright) → build → deploy, with a manual approval gate before prod.

---

## 10. Security

- Sanitize all scraped HTML before storage/render (`nh3`/`bleach`) — scraped content is untrusted input and a real stored-XSS vector.
- Secrets via a cloud-native secrets manager, not `.env` files in production.
- RBAC on admin/scrape-trigger endpoints — "Admin only" as a boolean flag isn't real access control.

---

## 11. Phased Roadmap

Don't build all of this before you have traffic. Suggested sequencing:

1. **Phase 1 — Foundation**: ship V2's stack correctly, add URL/title-level dedup, cursor pagination, basic Redis caching. Get it live and correct.
2. **Phase 2 — Scale & visibility**: Meilisearch, observability stack, Terraform + CI/CD, read replica.
3. **Phase 3 — AI-native**: `pgvector` embeddings, story clustering, summarization, semantic related-articles, personalized feed.
4. **Phase 4 — Platform**: public API product with API-key auth, real-time SSE ticker, PWA, developer docs.

---

## 12. Optional: If There's a Regional/Bandwidth Angle

Not assuming this is part of the brief, but worth flagging since it's a cheap differentiator if relevant: a lite/text-only rendering mode for low-bandwidth connections, multi-language source normalization, and source credibility tagging double as both an engineering feature and a media-literacy story — useful if you ever want to position this toward underserved or emerging markets rather than as a generic aggregator.

---

## 13. Critical Gaps & Risk Register (Read Before Building)

Everything in §1–12 assumes the product is legally and operationally sound. It's a strong technical design with one structural blind spot and a handful of second-order gaps. Ranked by how much damage ignoring them does.

### 13.1 Copyright exposure — the single biggest risk in this entire document

The current schema (`Article.body`, `RawDocument.raw_html_ref`) implies storing and rendering **full article text** scraped from other publishers. That's not a hypothetical legal footnote — full-text republication without a license is the exact failure mode that has killed or gutted aggregators before (takedown demands, "hot news" claims, outright shutdown). It's fixable at the schema level before it's a habit at the product level:

- `Article` stores an **excerpt** (first ~40 words or an AI-generated summary) and a **canonical outbound `source_url`** — never the full scraped body.
- The full extracted text lives only in `RawDocument` (private, internal-only — used for embedding/clustering/summarization, never rendered to end users).
- Every `Story`/`Article` card ends in a clear, prominent **"Read the full story at [Source]"** outbound link. This isn't just legal cover — it's the honest value proposition of an aggregator: *we help you find coverage, we don't replace the newsroom that did the work.*
- Respect `robots.txt` and each source's ToS at fetch time; identify your bot with a real `User-Agent` and contact URL, don't spoof a browser.
- If/when specific publishers matter enough to your traffic, pursue actual syndication agreements — that's the only way to legitimately show full text.

This one adjustment changes a few field names in §3 and reframes the product pitch slightly (curation + discovery, not a mirror) — worth doing now, painful to retrofit after launch.

### 13.2 NDPR compliance (Nigeria Data Protection Regulation)

`UserPreference` and `ReadHistory` (§3) are personal data under NDPR the moment they're tied to an identifiable user. Needed before those tables collect real users, not after:
- A documented lawful basis (consent) captured at signup/onboarding, not implied.
- A data retention policy — `ReadHistory` doesn't need to live forever; define a TTL.
- A user-facing data export/delete path (NDPR gives data subjects that right).

### 13.3 Content moderation queue

Fully automated ingestion means a bad or compromised source can publish directly to your feed with no human in the loop. Add a lightweight `Source.trust_tier` (e.g. `auto-publish` for established sources, `review-queue` for new/low-trust ones) so new sources are quarantined until they've proven reliable, and any source can be manually demoted if it starts publishing garbage or gets compromised.

### 13.4 AI cost governance

§5's enrichment step calls an LLM per article. At real scale (hundreds–thousands of articles/day across many sources) this is the line item most likely to blow up unexpectedly. Concrete guardrails:
- A daily/monthly spend ceiling with an alert, not just a cache.
- A cheap fallback path (SimHash + TF-IDF clustering only, no LLM call) that kicks in automatically if the budget alert fires — degrade gracefully, don't go down.
- Batch embedding calls where the provider supports it instead of one request per article.

### 13.5 SEO & distribution — under-specified given it's a news product

Traffic for a news aggregator lives or dies on discoverability, and this wasn't addressed in §1–12:
- `schema.org` structured data (`NewsArticle`, `Organization`) on every story page — this is what gets you into Google News—style surfaces and rich results.
- Dynamic `sitemap.xml` (content changes constantly — a static one goes stale fast).
- Open Graph + Twitter Card meta per story — this is what makes a shared link look credible instead of a bare URL, and social referral is a real traffic channel for news.
- Consider exposing your own RSS/Atom feed per category — mildly ironic for an aggregator to also be a source, but it's low effort and plugs you into the same distribution graph you're consuming from.

### 13.6 Source-fetch resilience against anti-bot defenses

Many publishers now sit behind Cloudflare/PerimeterX-style bot protection. §2's circuit breaker handles a *dead* feed; it doesn't handle a feed that's actively blocking you. Budget for: rotating/well-behaved fetch identity, a documented "graceful degradation" path per source (RSS fallback if scraping is blocked), and accept that some sources will simply require an official API/partnership rather than scraping — plan for that as a source `type`, not an edge case.

---

### Updated Phased Roadmap (supersedes §11)

| Phase | Adds |
|---|---|
| **Phase 1 — Foundation** | V2 stack, correctly built. Excerpt-only storage model (§13.1) from day one — retrofitting this later is the expensive version. URL/title dedup, cursor pagination, basic Redis caching. |
| **Phase 2 — Scale & visibility** | Meilisearch, observability stack, Terraform + CI/CD, read replica, structured data + sitemap (§13.5), source trust tiers (§13.3). |
| **Phase 3 — AI-native** | `pgvector` embeddings, story clustering, summarization, semantic related-articles, personalized feed — with cost governance (§13.4) live *before* this phase, not after the first surprise bill. |
| **Phase 4 — Platform** | Public API product, real-time SSE ticker, PWA, developer docs, NDPR data-export tooling (§13.2) if you have real user accounts by this point. |
