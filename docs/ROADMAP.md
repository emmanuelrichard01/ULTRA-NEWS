# Roadmap — ULTRA-NEWS V3

> Living document. Updated as phases complete.

---

## Phase 1: Foundation ✅

Security hardening, data model, and design system.

### Security & Data Integrity
- [x] HTML sanitization via `nh3` (closes stored XSS from `dangerouslySetInnerHTML`)
- [x] Timezone-aware datetimes throughout (fixes naive datetime warnings)
- [x] Celery `.delay()` for ingestion (replaces raw `threading.Thread` — process-global state mutation)
- [x] Structured logging via `structlog` (replaces stdout hijacking)
- [x] `.gitignore` with celerybeat-schedule exclusion

### Data Layer
- [x] `Story` cluster model (title, slug, source_count, independent_count, status, velocity_score, embedding)
- [x] `RawDocument` model (internal-only full text, never rendered)
- [x] `Article` excerpt field (~40 words) + content_hash (SHA-256 dedup)
- [x] `SearchVectorField` + GIN index for full-text search
- [x] Cursor pagination (replaces offset — stable under high insert rates)

### API
- [x] Versioned endpoints (`/api/v1/`)
- [x] Story list + detail endpoints with cursor pagination
- [x] GitHub OIDC JWT auth for ingestion endpoint
- [x] API Key auth for seed endpoint

### Frontend — Wire Room Design System
- [x] Design token overhaul (ink/paper/amber/teal/red color system)
- [x] Three-role typography (Fraunces / Geist / IBM Plex Mono)
- [x] CorroborationMeter component (5-segment signal bars)
- [x] FannedStack CSS treatment (multi-source visual indicator)
- [x] StoryCard (hero + standard variants)
- [x] Story Cluster detail page with timeline
- [x] Excerpt-only article page with outbound CTA
- [x] Shape-matched skeleton loaders

### Infrastructure
- [x] Docker Compose (6 services: db, redis, backend, worker, beat, frontend)
- [x] CI pipeline (ruff + tsc + build)
- [x] `.env.example` template
- [x] Makefile with full lifecycle commands

### Cleanup
- [x] Deleted duplicate scripts (assign_categories.py, seed_categories.py, silent_ingest.py)
- [x] Centralized categorization module (`core/categorization.py`)
- [x] Rewritten ARCHITECTURE.md

---

## Phase 2: High-Leverage UI/UX ✅

Frontend features that visually sell the multi-source intelligence concept.

- [x] **Story Timeline** — Chronological "git log" showing how a story evolved across outlets, with time-delta badges (+2h 15m later)
- [x] **Coverage Velocity Leaderboard** — Top trending stories ranked by source accumulation rate (Δsources/Δtime)
- [x] **Side-by-Side Headline Framing** — Horizontally scrollable cards showing exact headlines from different outlets on the same event
- [x] **Informational Pages** — Terminal-grade About (with Evolution Log), Privacy, Terms, RSS system architecture pages
- [x] **Footer Navigation** — Active links to all informational pages + social links (X, LinkedIn, GitHub)

---

## Phase 3: Semantic Intelligence ✅

The algorithmic backbone that makes the three-tier lifecycle actually work.

- [x] **Semantic Clustering** — Replaced exact title match with `pgvector` + `fastembed` (`bge-small-en-v1.5`, 384d vectors). Cosine similarity threshold ≥ 0.80 within a 72-hour time window.
- [x] **Independent Domain Tracking** — `independent_count` counts unique source URLs so wire syndication (10 outlets running the same AP text) doesn't inflate corroboration.
- [x] **Trust Graph Foundations** — Nightly Celery task computing `articles_broken_first` and `corroboration_rate` per source. Evidence-based reputation instead of static editorial tiers.
- [x] **Ask the Wire Room (RAG)** — `/api/v1/ask` endpoint. Embeds user query, searches pgvector for top-5 similar articles, returns structured synthesis with source citations. (Mock synthesis — no LLM API key configured yet.)

---

## Phase 4: Source Expansion & Operational Hardening ✅

The source pool determines whether the Wire/Developing/Reporting lifecycle produces meaningful results. This phase made the system operationally robust.

### Source Infrastructure
- [x] **Wire Service Sources** — Added Reuters, AP News, AFP, UPI (highest cross-outlet overlap feeds)
- [x] **Major Global Sources** — Added The Guardian, Al Jazeera English, CNN, NPR, ABC News, Sky News, BBC
- [x] **Specialist Sources** — Added MIT Technology Review, Nature News, STAT News, Politico, Bloomberg
- [x] **Regional Diversity** — Kept Premium Times, Punch; removed permanently broken feeds; added South China Morning Post
- [x] **Source Registry Refactor** — `core/source_registry.py` is the single source of truth for all source definitions with tier/region metadata
- [x] **Tier/Region System** — 4 tiers (Wire Services, Major Global, Specialist, Regional) × 6 regions (Global, NA, EU, Africa, Asia-Pacific, Middle East)
- [x] **Source Deactivation** — Dead feeds auto-deactivated during seed; `is_active = False` for permanently broken feeds

### Bug Fixes
- [x] **Tier Classification Fix** — `compute_tier()`: velocity alone no longer promotes single-source stories to Developing. `independent_count` is the sole tier driver.
- [x] **Feed Count Fix** — API `list_stories` and `list_news` return filtered counts, not global totals
- [x] **Dead Code Removal** — Removed `Story.update_status()`, `stopgap_cluster.py`, `list_sources.py`, `seed_sources.py`

### API Enhancements
- [x] **`/api/v1/sources`** — Source registry endpoint with tier, region, health, article counts, corroboration rates
- [x] **`/api/v1/stories/{slug}/related`** — pgvector-based semantic similarity for related stories
- [x] **ISR revalidation fix** — Webhook now uses `instance.slug` correctly
- [x] **Story detail enrichment** — Response includes `independent_count`, `velocity_score`, `sources` array

### Frontend Overhaul
- [x] **Shared Infrastructure** — Centralized `lib/types.ts` (types + CATEGORY_MAP) and `lib/api.ts` (API client)
- [x] **FeedPage Component** — Parameterized layout engine for homepage, developing, reporting feeds
- [x] **Category Pages** — 9 categories (added Sports, Health, World) using shared infrastructure
- [x] **StoryCard Enhancements** — Independent count display, verified badge, velocity indicator
- [x] **VelocityLeaderboard** — Dynamic bar scaling, position indicators, independent domain counts
- [x] **Story Detail Page** — Related Stories (real pgvector data), Coverage Velocity step-chart, enhanced Timeline (cumulative counts, pulse animation), Side-by-Side Framing with source badges
- [x] **Informational Pages** — Professional rebuild of About (pipeline diagram, dynamic stats), Privacy (§1-§7, GDPR), Terms (§1-§12), RSS (dynamic source table with health indicators)
- [x] **Navbar** — Added Sports, Health, World topics

### Makefile & Docs
- [x] **Makefile Rebuild** — Fixed broken `seed` target, added `restart`/`status`/`db-shell`/`nuke` targets, DRY variables
- [x] **Documentation Overhaul** — Updated README, ROADMAP, SOP, ARCHITECTURE, DEPLOYMENT to reflect all Phase 4 changes

---

## Phase 5: Platform & Extensions

- [ ] **SSE Breaking News Ticker** — Server-Sent Events for real-time story updates on the frontend
- [ ] **LLM Intelligence Briefs** — Multi-source synthesis when a story reaches Corroborated (requires LLM API key)
- [ ] **Public API Documentation** — OpenAPI spec with developer portal
- [ ] **Observability** — OpenTelemetry traces, Prometheus + Grafana dashboards
- [ ] **On-Device Personalization** — Local `ReadHistory` embeddings via `transformers.js` (WASM/CPU, zero server tracking)
- [ ] **Content Credentials (C2PA)** — Read/verify image provenance as adoption grows
- [ ] **Multi-language Support** — Multi-language embedding model to expand source diversity beyond English

---

## Design Principles

These aren't aspirational — they're the decisions we've already made and enforce:

1. **Stories, not articles.** The `Story` cluster is the primary entity. Articles are evidence.
2. **Excerpt-only display.** We're an aggregator, not a publisher. Outbound links respect the source.
3. **Independent counts, not raw counts.** Wire syndication doesn't equal corroboration.
4. **Local ML, no API dependency.** `fastembed` runs inside Docker. No OpenAI billing surprises.
5. **Cursor pagination, not offset.** Stable under continuous ingestion.
6. **Sanitize at ingestion, not rendering.** `nh3` at write time, not `DOMPurify` at read time.
