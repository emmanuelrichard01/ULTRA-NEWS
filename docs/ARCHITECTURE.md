# 🏗️ System Architecture: ULTRA-NEWS V3

## 1. High-Level Overview

ULTRA-NEWS V3 is a **story-centric** news aggregation platform built around the concept of multi-source convergence. Unlike traditional aggregators that display a flat list of deduplicated articles, V3 introduces the **Story Cluster** — a first-class entity representing a real-world event, with all contributing sources visible and countable.

The architecture splits cleanly into:
- **Backend**: Python 3.11, Django 5.x, Django Ninja (typed REST API)
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Data**: PostgreSQL 16 (primary), Redis 7 (cache + Celery broker)
- **Processing**: Celery + Redis (background scraping, scheduled ingestion)
- **Infrastructure**: Docker Compose (dev), Vercel + Render (production)

## 2. Core Concepts

### Story Clusters
The V3 differentiator. When multiple outlets cover the same event, their articles are grouped into a single `Story`. Each Story tracks:
- `source_count` — how many independent sources are covering it
- `status` — "Developing" (1-2 sources) or "Corroborated" (3+)
- `velocity_score` — Coverage momentum (sources / hours since first seen)
- A list of all contributing `Articles`, explicitly marking the `is_primary_source` (first to report)

### Excerpt-Only Display Model
Per §13.1 of the V3 specification, articles are displayed as excerpts (~40 words) with prominent outbound "Read at [Source]" links. Full extracted text is stored privately in `RawDocument` for internal processing only (future: embeddings, AI summarization).

### The Wire Room Design System
The UI borrows from wire service visual language — the convergence of multiple feeds into verified reports. The signature design elements are:
- **Corroboration Meter** — 5-segment signal bars (amber = developing, teal = corroborated)
- **Fanned Stack** — stacked card silhouettes showing multi-source coverage at a glance
- **Three-role typography** — Fraunces (editorial), Geist (interface), IBM Plex Mono (data/telemetry)

## 3. Data Layer

### Models
- **`Source`** — RSS feed configuration + health tracking (active status, consecutive failures, fetch interval)
- **`Story`** — Real-world event cluster (title, slug, source_count, status, velocity_score, categories)
- **`Article`** — Individual source coverage (excerpt, content_hash, is_primary_source, story FK, SearchVectorField)
- **`RawDocument`** — Full extracted text, internal-only (linked 1:1 to Article)
- **`Category`** — Taxonomy (Tech, Politics, Business, Entertainment, Science, Art)

### Key Design Decisions
- **Cursor pagination** (`published_date + id`) instead of offset — stable under high insert rates
- **SearchVectorField + GIN index** for performant full-text search
- **Content hashing** (SHA-256) for deduplication

## 4. API Layer (Django Ninja)

All endpoints under `/api/v1/`:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | — | Deep health check (DB + Redis) |
| `/stories` | GET | — | List story clusters (cursor pagination) |
| `/stories/{slug}` | GET | — | Story detail with all contributing articles |
| `/news` | GET | — | List articles (search, category filter, cursor/offset) |
| `/articles/{slug}` | GET | — | Article detail (excerpt-only) |
| `/admin/trigger-ingest` | POST | OIDC JWT | Trigger Celery ingestion task via GitHub Actions |
| `/admin/seed-db` | POST | API Key | Seed categories + sources |

Authentication: The ingest endpoint uses secure `GitHubOIDCAuth` validating JWKS from GitHub Actions. Other admin endpoints may use `X-Admin-Key` header. Public endpoints are unauthenticated.

## 5. Ingestion Pipeline

```
Celery Beat (30min) → ScraperService → RSS Feed → trafilatura (extract) 
  → nh3 (sanitize) → SHA-256 (dedup hash) → Article + RawDocument (persist) 
  → Category assignment (keyword matching) → Source health update
```

Each source is processed independently — one source's failure doesn't affect others. The pipeline is idempotent (safe to retry).

## 6. Frontend Architecture

Next.js 16 App Router with:
- **Server Components** for data fetching (pages)
- **Client Components** for interactivity (SearchBar, HeroCarousel, ThemeToggle)
- **ISR** with 60-second revalidation on the homepage
- **Tag-based Caching (`revalidateTag`)** — Django fires webhooks to `/api/revalidate?tag=story:{id}` when clusters update, instantly purging the specific cache while keeping everything else fast.
- **`next/font`** self-hosting for Fraunces, Geist, IBM Plex Mono (no layout shift)

## 7. Deployment

| Service | Platform | Details |
|---------|----------|---------|
| Frontend | Vercel | Root: `frontend/`, framework: Next.js |
| Backend | Render | Root: `backend/`, runtime: Docker |
| PostgreSQL | Render | Managed, internal URL |
| Redis | Render | Managed, internal URL |
| Ingestion | GitHub Actions | Cron: every 30 minutes |

## 8. What's Next (Phase 3-4)

- **Phase 3 (AI-Native)**: pgvector embeddings, RAG chat ("Ask the Wire Room"), Trust Graphs (automated source tiering based on primary-source behavior), On-Device personalization via WASM.
- **Phase 4 (Platform)**: Observability (OpenTelemetry), Terraform, Public API, SSE breaking ticker, PWA, C2PA Content Credentials.
