# 🗺️ ULTRA-NEWS V3 — Roadmap

## Phase 1: Foundation ✅ (Current)

### Security & Hardening
- [x] HTML sanitization via `nh3` (closes XSS vector)
- [x] Timezone-aware datetimes throughout
- [x] Celery `.delay()` for ingestion (replaces raw threading)
- [x] Structured logging via `structlog`
- [x] Root `.gitignore` with celerybeat-schedule exclusion

### Data Layer
- [x] `Story` cluster model (title, slug, source_count, status)
- [x] `RawDocument` model (internal-only full text)
- [x] `Article` excerpt field + content_hash for dedup
- [x] `SearchVectorField` + GIN index
- [x] Cursor pagination (replaces offset)

### API
- [x] Versioned endpoints (`/api/v1/`)
- [x] Story list + detail endpoints
- [x] Excerpt-only article detail model
- [x] Backward-compatible legacy offset pagination

### Frontend — Wire Room Design System
- [x] Design token overhaul (ink/paper/amber/teal/red)
- [x] Three-role typography (Fraunces / Geist / IBM Plex Mono)
- [x] CorroborationMeter component
- [x] FannedStack CSS treatment
- [x] StoryCard (hero + standard variants)
- [x] Story Cluster detail page
- [x] Excerpt-only article page with outbound CTA
- [x] Subscribe page ("The Wire Brief")
- [x] Shape-matched skeleton loaders

### Infrastructure
- [x] CI pipeline (ruff + tsc + build)
- [x] `.env.example` template
- [x] Updated docker-compose (PostgreSQL 16, explicit env vars)
- [x] Updated Makefile with working seed command

### Cleanup
- [x] Deleted duplicate scripts (assign_categories.py, seed_categories.py, silent_ingest.py)
- [x] Deleted replaced components (FeedItem, HeroStory, Pagination)
- [x] Centralized categorization module
- [x] Rewritten ARCHITECTURE.md (no longer stale)

---

## Phase 1.5: Tighten & Scale (Current)

### Security & Observability
- [ ] **GitHub OIDC Validation** — drop static `ADMIN_API_KEY` for ingestion, validate OIDC tokens via JWKS.
- [ ] **Health Checks** — Add `last_successful_ingest_at` tracking; alert if > 45m quiet.
- [ ] **Testing** — Pytest + fixtures for ingestion pipeline (RSS mocking, clustering dedup).
- [ ] **Next.js Caching** — Replace `cache: 'no-store'` with `revalidateTag('story:{id}')` and secure webhook.
- [ ] **Data Model** — Add `is_primary_source` to Article to distinguish first reports from later corroboration.
- [ ] **Pagination** — Add deprecation warning for legacy offset pagination.

---

## Phase 2: High-Leverage UI/UX Moves

- [ ] **Story Timeline** — Chronological "git log" of how a story evolved across outlets.
- [ ] **Coverage Velocity** — Rank trending by rate of new sources ($\Delta source\_count / \Delta t$) rather than raw traffic.
- [ ] **Side-by-Side Headline Framing** — Unbiased, side-by-side display of exact headlines from different outlets on Story page.
- [ ] **Wire Brief Polish** — Query specifically for `status=CORROBORATED` within the last 24h.

---

## Phase 3: The Bigger AI Bets (Differentiators)

- [ ] **Ask the Wire Room** — Strict RAG chat over the local ingested corpus using `pgvector`. Citations directly to `Article` IDs.
- [ ] **Trust Graph** — Compute evidence-based source reliability based on who is frequently first-to-report and later corroborated. Replaces manual `trust_tier`.
- [ ] **On-Device Personalization** — Local, privacy-preserving `ReadHistory` embeddings via `transformers.js` (WASM/CPU).

---

## Phase 4: Infrastructure & Platform

- [ ] **Observability** — OpenTelemetry traces, Prometheus + Grafana.
- [ ] **Terraform** — Infrastructure as code for reproducible deployments.
- [ ] **Meilisearch/Typesense** — Sub-50ms typo-tolerant search.
- [ ] **Public API & Webhooks** — API-key authenticated, developer docs.
- [ ] **Content Credentials (C2PA)** — Read/verify support for image provenance as adoption grows.
