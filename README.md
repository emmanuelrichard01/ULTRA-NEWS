# ULTRA-NEWS V3 — The Wire Room

> **Story-centric news intelligence.** Multiple outlets covering the same event, collapsed into one verified cluster — so you see the full picture, not just one outlet's take.

![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![Django](https://img.shields.io/badge/django-5.x-green.svg)
![Next.js](https://img.shields.io/badge/next.js-16-black.svg)
![PostgreSQL](https://img.shields.io/badge/postgres-16+pgvector-blue.svg)

---

## What This Is

Ultra News is a news aggregation platform built around a single architectural bet: **stories, not articles, are the primary entity.** When Reuters, BBC, and The Guardian all cover the same event, their articles are semantically clustered into one `Story` object with an explicit source count, a verification lifecycle status, and a velocity score tracking how fast coverage is accumulating.

The result is a three-tier intelligence feed:

| Feed | Filter | Purpose |
|------|--------|---------|
| **The Wire** | `status = wire` | Raw intercepts. Single-source, unverified first reports. |
| **Developing** | `status = developing` | Gaining traction. 2 independent sources confirming. |
| **Reporting** | `status = corroborated` | Verified. 3+ independent domains corroborating. |
| **Topics** | `category = {slug}` | Analytical lens. 9 categories: Tech, Politics, Business, Science, Sports, Health, World, Entertainment, Africa. |

This lifecycle — Wire → Developing → Reporting — is the core product. Most aggregators don't attempt it.

---

## Architecture at a Glance

```text
[35+ RSS Feeds] → Celery Worker → feedparser (parse)
  → trafilatura (deep-fetch full text) → nh3 (sanitize HTML)
  → fastembed (vectorize title+excerpt) → pgvector (semantic cluster)
  → Story/Article persist → Category assignment → ISR webhook to Next.js

[Next.js 16 App Router] ← Django Ninja REST API ← PostgreSQL 16 (stories, vectors)
                                                 ← Redis 7 (cache, Celery broker)
```

| Layer | Technology | Why |
|-------|-----------|-----|
| **API** | Django Ninja | Typed, fast, auto-documented. Better than DRF for this scope. |
| **Clustering** | pgvector + fastembed (`bge-small-en-v1.5`, 384d) | Local ML inference. No API costs. Cosine similarity > exact title match. |
| **Frontend** | Next.js 16 (RSC + App Router) | Server components for data; ISR for caching. |
| **Processing** | Celery + Redis | Proper task queue. Retry, monitoring, no raw threading. |
| **Sanitization** | nh3 (Rust-based) | Closes the stored XSS vector from `dangerouslySetInnerHTML`. |
| **Search** | PostgreSQL `SearchVectorField` + GIN | Pragmatic. No ElasticSearch overhead at this scale. |

### Data Model

```
Source ──┐
         ├── Article ──→ Story (cluster)
         └── RawDocument (1:1 with Article, internal-only full text)

Story ──→ [wire | developing | corroborated]
       ──→ velocity_score (sources/hour)
       ──→ independent_count (unique domains)
       ──→ embedding (384d vector, cluster centroid)
```

- **`Source`** — RSS feed config with tier/region metadata + health tracking (consecutive failures, last_fetched_at).
- **`Story`** — The primary entity. A real-world event with source_count, independent_count, velocity, status.
- **`Article`** — Individual piece from one source. Excerpt-only display (~40 words) + outbound link.
- **`RawDocument`** — Full extracted text. Internal-only. Powers embeddings and future AI summarization.

### Key Trade-offs

| Decision | What we chose | What we rejected | Why |
|----------|--------------|-----------------|-----|
| Clustering | Semantic vectors (cosine similarity ≥ 0.80) | Exact title match | Three outlets write three different headlines for the same event. Exact match creates permanent single-source silos. |
| Embedding model | `bge-small-en-v1.5` (384d, local) | OpenAI API embeddings | Zero API cost. Runs inside Docker. Slightly lower quality, but the 72h time window compensates. |
| Pagination | Cursor (`published_date + id`) | Offset | Stable under high insert rates. No phantom rows. |
| Display model | Excerpt-only (~40 words) | Full article rendering | We're an aggregator, not a publisher. Outbound links respect the source. |
| Auth (ingest) | GitHub OIDC JWT | Static API key alone | Key rotation without redeployment. Verifiable identity chain. |

---

## API Endpoints

All under `/api/v1/`:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/stories` | GET | — | List story clusters. Cursor pagination, filter by `status`, `category`. |
| `/stories/{slug}` | GET | — | Story detail: all contributing articles, timeline, framing, independent_count, velocity_score. |
| `/stories/{slug}/related` | GET | — | Semantically related stories via pgvector similarity search. |
| `/news` | GET | — | List articles. Full-text search via `q=`, category filter. |
| `/articles/{slug}` | GET | — | Single article detail (excerpt + outbound link). |
| `/sources` | GET | — | Source registry: all feeds with tier, region, health, article counts. |
| `/ask` | POST | — | RAG endpoint. Semantic search over ingested corpus. |
| `/health` | GET | — | Deep health check (DB + Redis + ingest recency). |
| `/admin/trigger-ingest` | POST | OIDC JWT | Trigger Celery ingestion via GitHub Actions. |
| `/admin/seed-db` | POST | API Key | Seed categories + sources from the source registry. |

---

## Quick Start

```bash
# 1. Clone & build
git clone https://github.com/emmanuelrichard01/ULTRA-NEWS.git
cd ULTRA-NEWS
make setup    # builds, starts, migrates, seeds

# 2. Access
# Frontend:  http://localhost:3000
# API Docs:  http://localhost:8000/api/v1/docs

# 3. Trigger first ingestion
make ingest
```

### Developer Commands

```bash
make help           # Show all commands
make status         # Service health check
make logs           # Tail all service logs
make logs-backend   # Backend only
make logs-worker    # Worker only
make logs-frontend  # Frontend only
make shell          # Django shell
make db-shell       # PostgreSQL shell (psql)
make lint           # Run linters (ruff + tsc)
make test           # Run all tests
make restart        # Restart all services
make clean          # Stop services, remove containers
make nuke           # ⚠️ Stop services + delete all data
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Backend

| Variable | Required | Description |
|:---|:---:|:---|
| `SECRET_KEY` | ✅ | Django security key |
| `DEBUG` | ✅ | `1` for dev, `0` for production |
| `ALLOWED_HOSTS` | ✅ | Comma-separated hostnames |
| `ADMIN_API_KEY` | ✅ | API key for admin endpoints |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `CELERY_BROKER_URL` | ✅ | Celery broker (same as REDIS_URL) |
| `CELERY_RESULT_BACKEND` | ✅ | Celery results (same as REDIS_URL) |
| `FRONTEND_URL` | ✅ | Frontend URL (for CORS) |

### Frontend

| Variable | Required | Description |
|:---|:---:|:---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL (no trailing slash) |
| `NEXT_PUBLIC_APP_URL` | — | Public app URL (for meta tags) |

---

## Project Status

### What Works ✅

- Story clustering via semantic vectors (pgvector + fastembed)
- Three-tier verification lifecycle (Wire → Developing → Reporting)
- 35+ sources across 4 tiers and 6 regions
- 9 topic categories (Tech, Politics, Business, Science, Sports, Health, World, Entertainment, Africa)
- Coverage Velocity Leaderboard (sources/hour ranking)
- Interactive Story Timeline with time-deltas and cumulative counts
- Side-by-Side Headline Framing comparison
- Coverage Velocity step-chart visualization
- Related Stories via pgvector semantic similarity
- Source registry with tier/region metadata and health monitoring
- RAG endpoint (`/api/v1/ask`) for semantic corpus queries
- Independent domain tracking (Trust Graph foundations)
- Full ingestion pipeline: RSS → trafilatura → nh3 → embedding → cluster
- ISR caching with tag-based revalidation webhooks
- Professional informational pages (About, Privacy, Terms, RSS/Sources)

### What's Next 🔜

- SSE real-time breaking news ticker
- LLM-powered multi-source intelligence briefs
- Public API documentation and developer portal
- Observability (OpenTelemetry traces, Prometheus)

See [ROADMAP.md](docs/ROADMAP.md) for the full breakdown.

---

## License

MIT License © 2025 Ultra News
