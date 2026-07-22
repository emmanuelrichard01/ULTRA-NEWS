# System Architecture — ULTRA-NEWS V3

> Last updated: July 2026 · Matches codebase at `main` HEAD (Phase 4 complete)

## 1. System Overview

ULTRA-NEWS V3 is a **story-centric** news aggregation platform. The core architectural bet is that a `Story` (a real-world event cluster) — not an individual `Article` — is the primary entity. When multiple outlets cover the same event, their articles are semantically clustered into a single Story with explicit corroboration tracking.

```text
┌─────────────────────────────────────────────────────────────────┐
│                        INGESTION PIPELINE                       │
│                                                                 │
│  Celery Beat (30m)  →  ScraperService  →  feedparser (RSS)      │
│       ↓                                                         │
│  trafilatura (deep-fetch full text from source URL)             │
│       ↓                                                         │
│  nh3 (Rust-based HTML sanitization — closes XSS vector)        │
│       ↓                                                         │
│  fastembed (bge-small-en-v1.5, 384d local inference)           │
│       ↓                                                         │
│  pgvector (cosine similarity clustering, threshold ≥ 0.80)     │
│       ↓                                                         │
│  Story/Article persist  →  Category assignment (keyword match)  │
│       ↓                                                         │
│  Django signal  →  ISR webhook to Next.js (/api/revalidate)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         SERVING LAYER                           │
│                                                                 │
│  Next.js 16 (App Router, RSC)  ←  Django Ninja REST API        │
│     ↑ ISR + tag-based cache         ↑ Cursor pagination        │
│     ↑ 60s revalidation              ↑ Redis response cache     │
│                                     ↑ PostgreSQL 16 + pgvector │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Backend API | Django + Django Ninja | 5.x / 1.x | Typed schemas, auto-docs, faster than DRF |
| Database | PostgreSQL + pgvector | 16 | Native vector similarity search, no external service |
| Cache/Broker | Redis | 7-alpine | Dual-purpose: API response cache + Celery broker |
| Task Queue | Celery + celery-beat | 5.3+ | Scheduled ingestion, retry logic, monitoring |
| Embedding | fastembed (`bge-small-en-v1.5`) | 0.2.6+ | 384d vectors, local inference, zero API cost |
| Frontend | Next.js (App Router) | 16 | Server Components, ISR, tag-based cache |
| Sanitization | nh3 | 0.2.15+ | Rust-based, closes stored XSS from `dangerouslySetInnerHTML` |
| Full-text search | PostgreSQL SearchVectorField + GIN | — | Pragmatic; avoids ElasticSearch for this scale |

---

## 2. Data Model

### Entity Relationships

```text
Source (1) ──→ (N) Article (N) ──→ (1) Story
                    │
                    └── (1:1) RawDocument

Story (N) ←──→ (N) Category
Article (N) ←──→ (N) Category
```

### Models

#### Source
RSS feed configuration + operational health tracking + tier/region metadata.

| Field | Type | Purpose |
|-------|------|---------|
| `url` | URLField (unique) | RSS feed endpoint |
| `source_type` | Enum: `news` / `primary` | Distinguishes editorial outlets from government/corporate primary sources |
| `is_active` | Boolean | Circuit breaker — auto-disabled on sustained failures |
| `consecutive_failures` | Integer | Failure counter for health monitoring |
| `tier` | Integer (1-4) | Source tier: 1=Wire, 2=Major Global, 3=Specialist, 4=Regional |
| `region` | CharField | Geographic region: global, north_america, europe, africa, asia_pacific, middle_east |
| `articles_broken_first` | Integer | Trust Graph: how often this source was the earliest reporter in a corroborated story |
| `corroboration_rate` | Float | Trust Graph: % of this source's articles that reached corroborated status |

**Source Registry**: All source definitions live in `core/source_registry.py` — the single source of truth for feed URLs, tiers, and regions. The `seed_db` endpoint reads from this registry.

#### Story (Primary Entity)
A real-world event cluster. This is what the user sees.

| Field | Type | Purpose |
|-------|------|---------|
| `status` | Enum: `wire` / `developing` / `corroborated` | Verification lifecycle tier |
| `source_count` | Integer | Total articles in the cluster |
| `independent_count` | Integer | Unique source domains (filters out wire syndication) |
| `velocity_score` | Float (indexed) | `independent_count / hours_since_first_seen` — trending metric |
| `embedding` | VectorField (384d) | Cluster centroid for semantic similarity matching |
| `first_seen_at` | DateTime | When the earliest article in the cluster was published |

**Tier Classification Logic** (`core/clustering.py` → `compute_tier()`):

```python
if independent_count >= 3:  → CORROBORATED (Reporting feed)
if independent_count == 2:  → DEVELOPING (Developing feed)
else:                       → WIRE (The Wire feed)
```

Velocity is a **ranking signal within a tier**, not a tier-promotion signal. It never promotes a single-source story.

#### Article
Individual source coverage. Excerpt-only display model.

| Field | Type | Purpose |
|-------|------|---------|
| `excerpt` | TextField | ~40 word excerpt for display |
| `content_hash` | CharField (SHA-256) | Deduplication across ingestion runs |
| `is_primary_source` | Boolean | `True` if this was the chronologically first article in its cluster |
| `embedding` | VectorField (384d) | Semantic vector for clustering |
| `search_vector` | SearchVectorField | PostgreSQL full-text search with GIN index |
| `story` | FK → Story | Cluster membership |

#### RawDocument
Full extracted text. **Internal only** — never rendered to end users. Powers embeddings, future AI summarization.

---

## 3. Clustering Pipeline (The Core Algorithm)

### How Articles Become Stories

```text
New article arrives
    │
    ├── Generate embedding: fastembed(title + excerpt) → 384d vector
    │
    ├── Query recent Stories (last 7 days, same broad window)
    │     └── For each candidate Story:
    │           ├── Time window check: |article.date - story.first_seen| < 72h
    │           └── Cosine similarity: cos(article.embedding, story.embedding)
    │
    ├── Best match ≥ 0.80 threshold?
    │     ├── YES → Append to existing Story
    │     │         ├── Update independent_count (unique source URLs)
    │     │         ├── Recalculate velocity_score
    │     │         └── Recompute tier via compute_tier()
    │     │
    │     └── NO → Create new Story (status=wire, velocity=0.0)
```

### Design Decisions

**Why 0.80 threshold?** Lower thresholds (0.60-0.75) caused false positives — unrelated articles from the same topical domain (e.g., two different AI announcements) were being clustered together. Higher thresholds (0.90+) recreated the exact-match problem. 0.80 is the empirical sweet spot for `bge-small-en-v1.5`.

**Why 72-hour window?** News events have a natural lifecycle. After 72 hours, even if a new article semantically matches, it's likely a follow-up story, not the same breaking event. The window prevents story clusters from growing indefinitely.

**Why `independent_count` instead of `source_count` for tier promotion?** Wire syndication. When AP publishes a story, 10 outlets may republish the exact same text. That's 10 `source_count` but 1 actual independent report. `independent_count` counts unique source URLs to filter this.

### Scorer Hierarchy

The system uses a `ClusterScorer` protocol with three implementations:

1. **`EmbeddingScorer`** (active) — Cosine similarity on 384d vectors. Requires fastembed.
2. **`TokenOverlapScorer`** (fallback) — Jaccard similarity on stemmed title tokens. No ML dependency.
3. **`ExactTitleScorer`** (baseline) — Kept as a null comparison. Never used in production.

---

## 4. API Layer

### Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/stories` | GET | — | List story clusters. Cursor pagination, filter by `status`, `category`. |
| `/api/v1/stories/{slug}` | GET | — | Story detail with articles, independent_count, velocity_score, sources. |
| `/api/v1/stories/{slug}/related` | GET | — | Semantically related stories via pgvector cosine similarity. |
| `/api/v1/news` | GET | — | List articles. Full-text search via `q=`, category filter. |
| `/api/v1/articles/{slug}` | GET | — | Single article detail (excerpt + outbound link). |
| `/api/v1/sources` | GET | — | Source registry with tier, region, health, article counts, corroboration rates. |
| `/api/v1/ask` | POST | — | RAG: semantic search over ingested corpus. |
| `/api/v1/health` | GET | — | Deep health check (DB + Redis + ingest recency). |
| `/api/v1/admin/trigger-ingest` | POST | OIDC JWT | Trigger Celery ingestion via GitHub Actions. |
| `/api/v1/admin/seed-db` | POST | API Key | Seed categories + sources from source registry. |

### Authentication

| Endpoint Pattern | Auth Method | Use Case |
|-----------------|-------------|----------|
| `/api/v1/stories`, `/news`, `/ask`, `/sources` | None (public) | Frontend consumption |
| `/api/v1/admin/trigger-ingest` | GitHub OIDC JWT (`GitHubOIDCAuth`) | GitHub Actions CI/CD |
| `/api/v1/admin/seed-db` | API Key header (`X-Admin-Key`) | Initial database setup |

### Pagination Strategy

**Cursor-based** using `(velocity_score, first_seen_at, id)` for stories and `(published_date, id)` for articles. Encoded as base64 opaque tokens.

Why cursor over offset: Under high insert rates (scraping adds articles continuously), offset pagination produces phantom rows (duplicates or skipped items). Cursor pagination is stable because it anchors to a specific row, not a position.

Legacy offset pagination is preserved with a deprecation warning for backward compatibility.

### Caching

- **API-level**: Redis with 300s TTL on story/article detail endpoints.
- **Frontend-level**: Next.js ISR with 60s revalidation on feed pages, tag-based revalidation on story detail pages.
- **Webhook invalidation**: Django signal fires on Story save → POST to `/api/revalidate?tag=story:{slug}` → Next.js purges that specific cache entry.

---

## 5. Source Registry

### Tier System

| Tier | Label | Purpose | Examples |
|------|-------|---------|----------|
| 1 | Wire Services | Backbone of global news. Highest cross-outlet overlap. | Reuters, AP News, AFP, UPI |
| 2 | Major Global | High-volume general-interest outlets. | BBC, The Guardian, CNN, NPR, Al Jazeera |
| 3 | Specialist | Domain-specific deep coverage. | TechCrunch, Ars Technica, STAT News, Politico |
| 4 | Regional | Geographic diversity and local coverage. | Premium Times, Punch, South China Morning Post |

### Region System

| Region Code | Label | Coverage |
|-------------|-------|----------|
| `global` | Global | Wire services, international outlets |
| `north_america` | North America | US-based outlets (CNN, NPR, etc.) |
| `europe` | Europe | UK/EU outlets (Guardian, Sky News, etc.) |
| `africa` | Africa | Nigerian outlets (Premium Times, Punch) |
| `asia_pacific` | Asia-Pacific | SCMP, other APAC sources |
| `middle_east` | Middle East | Al Jazeera English |

### Health Monitoring

Each source tracks `consecutive_failures` and `last_fetched_at`. Sources with sustained failures are auto-deactivated (`is_active = False`). The `/api/v1/sources` endpoint exposes this health data for the frontend RSS/Sources dashboard.

---

## 6. Frontend Architecture

### Rendering Strategy

| Page | Rendering | Cache |
|------|-----------|-------|
| Homepage (The Wire) | Server Component (FeedPage) | ISR 60s |
| `/developing` | Server Component (FeedPage) | ISR 60s |
| `/reporting` | Server Component (FeedPage) | ISR 60s |
| `/story/{slug}` | Server Component | Tag-based (`story:{slug}`) |
| `/{category}` | Server Component | No-store (always fresh) |
| `/about`, `/rss` | Static | ISR 5m (dynamic data from `/sources` API) |
| `/privacy`, `/terms` | Static | Build-time |

### Shared Infrastructure

| Module | Purpose |
|--------|---------|
| `lib/types.ts` | All API response types (`StoryDetail`, `SourceInfo`, etc.) + `CATEGORY_MAP` |
| `lib/api.ts` | Centralized API client (`fetchStories`, `fetchStory`, `fetchRelatedStories`, `fetchSources`) |
| `components/FeedPage.tsx` | Parameterized layout engine for all feed pages (home, developing, reporting) |

### Design System: The Wire Room

The visual language borrows from wire service aesthetics — AP/Reuters newsroom terminals where multiple feeds converge into verified reports.

**Typography (Three Roles):**
- **Fraunces** — Editorial headlines. Serif, high contrast.
- **Geist** — Interface text. Clean sans-serif.
- **IBM Plex Mono** — Data, timestamps, telemetry. Monospace precision.

**Signature Components:**
- **CorroborationMeter** — 5-segment signal bars. Amber (1-2 sources) → Teal (3+ sources).
- **FannedStack** — CSS stacked card silhouettes indicating multi-source coverage.
- **VelocityLeaderboard** — Top trending stories ranked by source accumulation rate, with position indicators and independent domain counts.
- **StoryTimeline** — Chronological "git log" of how a story evolved across outlets, with time-deltas and cumulative source counts.
- **HeadlineFraming** — Side-by-side display of exact headlines from different outlets on the same event.
- **CoverageVelocityChart** — SVG step-chart showing cumulative source count over time with interactive tooltips.
- **RelatedStories** — Horizontal scroll of semantically related stories from pgvector similarity search.

---

## 7. Infrastructure

### Docker Compose (Development)

```text
Services:
  db        — pgvector/pgvector:pg16 (PostgreSQL + vector extension)
  redis     — redis:7-alpine
  backend   — Django (auto-migrate on start, runserver)
  worker    — Celery worker (concurrency=2)
  beat      — Celery beat (DatabaseScheduler)
  frontend  — Next.js 16 (dev server)
```

### Production (Vercel + Render)

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | Root: `frontend/`, framework: Next.js |
| Backend API | Render Web Service | Root: `backend/`, runtime: Docker, ≥1GB RAM |
| Celery Worker | Render Background Worker | Same image, different command |
| Celery Beat | Render Background Worker | DatabaseScheduler |
| PostgreSQL | Render Managed | Requires `CREATE EXTENSION vector` |
| Redis | Render Managed | Shared broker + cache |

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the full guide.

---

## 8. Trust Graph (Source Reputation)

The Trust Graph replaces static editorial trust tiers with evidence-based source reputation. Computed nightly via Celery task.

**Metrics per Source:**
- `articles_broken_first` — How many times this source was the earliest (primary) article in a story that later reached corroborated status.
- `corroboration_rate` — Percentage of this source's articles that belong to corroborated stories.

A source with a high `articles_broken_first` and high `corroboration_rate` is empirically trustworthy — it reports early and gets confirmed. A source with high article volume but low corroboration rate is noisy.

The `/api/v1/sources` endpoint exposes these metrics alongside tier/region metadata and health indicators, powering the frontend RSS/Sources dashboard.

---

## 9. Known Limitations & Future Work

| Limitation | Impact | Planned Fix |
|-----------|--------|-------------|
| No LLM-powered summarization | Stories use first article's excerpt as summary | Integrate LLM API for multi-source synthesis (Phase 5) |
| Keyword-based categorization | Misses nuanced topics | Upgrade to embedding-based classification |
| No real-time push | Users must refresh for new stories | SSE/WebSocket ticker (Phase 5) |
| Single-language (English) | Limits source diversity | Multi-language embedding model (Phase 5) |
