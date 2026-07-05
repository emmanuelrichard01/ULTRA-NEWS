# 📰 ULTRA-NEWS V3

> **The Wire Room.** A story-centric news aggregation platform that triangulates coverage from multiple sources — so you see the full picture, not just one outlet's take.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![Django](https://img.shields.io/badge/django-5.x-green.svg)
![Next.js](https://img.shields.io/badge/next.js-16-black.svg)
![PostgreSQL](https://img.shields.io/badge/postgres-16-blue.svg)

---

## 🧠 What Makes V3 Different

V3 isn't just "we display articles" — it's "we know that 12 outlets are covering the same event, and we've collapsed that into one verified story."

| V2 | V3 |
|---|---|
| Flat article list | **Story Clusters** — multiple sources grouped into one event |
| Full-text scraping + rendering | **Excerpt-only display** + outbound "Read at [Source]" links |
| No deduplication | **Content hashing** (SHA-256) for dedup |
| Offset pagination | **Cursor pagination** — stable under high insert rates |
| `threading.Thread` for ingestion | **Celery `.delay()`** — proper task queue |
| No HTML sanitization | **nh3** — Rust-based sanitization (XSS prevention) |
| `print()` logging | **structlog** — structured JSON logging |
| Stale architecture docs | **Accurate docs** matching the actual codebase |

---

## ✨ The Wire Room Design System

The visual language borrows from the wire service — the AP/Reuters newsroom where multiple feeds converge into one verified report — because that convergence is literally what the ingestion pipeline does.

### Signature Elements

| Element | Purpose |
|---------|---------|
| **Corroboration Meter** | 5-segment signal bars: amber (1-2 sources, "Developing") → teal (3+, "Corroborated") |
| **Fanned Stack** | Stacked card silhouettes showing multi-source coverage at a glance |
| **Three-Role Typography** | Fraunces (editorial headlines), Geist (interface), IBM Plex Mono (data/telemetry) |

### Color System

| Token | Hex | Role |
|---|---|---|
| `ink` | `#12141C` | Primary text/surface — blue-black, not flat `#000` |
| `paper` | `#F7F5F0` | Primary surface — warm off-white |
| `signal-amber` | `#E8A33D` | Functional: "Developing" status (1-2 sources) |
| `verified-teal` | `#1F7A6C` | Functional: "Corroborated" status (3+ sources) |
| `wire-red` | `#C4432B` | Breaking/urgent — used sparingly |

---

## 🏗 Architecture

```
[RSS Feeds] → Celery Worker → trafilatura (extract) → nh3 (sanitize)
  → SHA-256 (dedup) → Article + RawDocument (PostgreSQL)
  → Category assignment → Source health tracking

[Next.js 16] ← Django Ninja API ← PostgreSQL (stories, articles)
                                 ← Redis (cache, Celery broker)
```

### Data Model

- **`Story`** — a real-world event cluster with source count, velocity score, and corroboration status
- **`Article`** — individual source coverage (excerpt + outbound link, tracking `is_primary_source`)
- **`RawDocument`** — full extracted text (internal-only, for future AI processing)
- **`Source`** — RSS feed config with health tracking

### API Endpoints

All under `/api/v1/`:

| Endpoint | Description |
|----------|-------------|
| `GET /stories` | List story clusters (cursor pagination) |
| `GET /stories/{slug}` | Story detail with all contributing sources |
| `GET /news` | List articles (search, filter, cursor/offset) |
| `GET /articles/{slug}` | Article excerpt + outbound link |
| `POST /admin/trigger-ingest` | Trigger ingestion (GitHub OIDC JWT required) |
| `POST /admin/seed-db` | Seed categories + sources (API key required) |
| `GET /health` | Deep health check (DB + Redis) |

---

## 🚀 Quick Start

```bash
# 1. Clone & Setup
git clone https://github.com/emmanuelrichard01/ULTRA-NEWS.git
cd ULTRA-NEWS
make setup

# 2. Access
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/api/v1/docs
```

### Other Commands

```bash
make ingest       # Trigger news ingestion
make logs         # Tail all service logs
make shell        # Open Django shell
make lint         # Run linters
make clean        # Stop services + delete data
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and configure:

### Backend

| Variable | Required | Description |
|:---|:---:|:---|
| `SECRET_KEY` | ✅ | Django security key |
| `DEBUG` | ✅ | `0` for production |
| `ALLOWED_HOSTS` | ✅ | Comma-separated hostnames |
| `ADMIN_API_KEY` | ✅ | API key for admin endpoints |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `FRONTEND_URL` | ✅ | Frontend URL (for CORS) |

### Frontend

| Variable | Required | Description |
|:---|:---:|:---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL (no trailing slash) |

---

## 🗺️ Roadmap

- **Phase 1** ✅ — Foundation (Story model, excerpt-only display, Wire Room design system, security hardening)
- **Phase 2** ✅ — Scale & Visibility (GitHub OIDC, Next.js Revalidation Webhooks, Timeline UI, Trending Velocity, Testing)
- **Phase 3** — AI-Native (pgvector RAG, Trust Graphs, On-Device Personalization)
- **Phase 4** — Platform (Observability, Terraform, Public API, SSE ticker, PWA)

See [ROADMAP.md](docs/ROADMAP.md) for the full breakdown.

---

## 📄 License

MIT License © 2025 Ultra News
