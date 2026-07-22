# Standard Operating Procedures

> Engineering standards and conventions for ULTRA-NEWS V3.

---

## 1. Code Standards

### Python (Backend)

- **Type hints** on all function signatures. `def cluster_article(article: Article, scorer: ClusterScorer = None) -> Story`
- **No bare `except`**. Catch specific exceptions. Log them.
- **No `print()`**. Use `structlog` or `logging` module.
- **No stdout/stderr hijacking**. If you're redirecting sys.stdout, the architecture is wrong.
- **DRY enforcement**: If logic exists in more than one place, extract to a module. The `categorization.py` centralization is the pattern to follow.
- **Function length**: If a function exceeds 50 lines, refactor. Extract helpers with descriptive names.

### TypeScript (Frontend)

- **No `any`**. Define interfaces for all API responses.
- **Shared types**: All API response types live in `lib/types.ts`. All fetch functions live in `lib/api.ts`.
- **Server Components by default**. Only add `"use client"` when the component needs interactivity (state, effects, event handlers).
- **No inline styles**. Use CSS variables from the design system (`var(--foreground)`, `var(--accent)`).
- **No duplicate type definitions**. If a type exists in `lib/types.ts`, import it — don't redefine locally.

### Comments

- Don't comment *what* the code does. Comment *why*.
- Architectural decisions go in `ARCHITECTURE.md`, not inline comments.

---

## 2. Data Integrity Rules

### Single Source of Truth

| Data | Authoritative Location | Not Here |
|------|----------------------|----------|
| Category definitions | `core/categorization.py` → `CATEGORY_REGISTRY` | Not in seed scripts, not in API endpoints |
| Source definitions | `core/source_registry.py` → `SOURCES` | Not duplicated in `api.py seed_db()` — it reads from the registry |
| Tier classification | `core/clustering.py` → `compute_tier()` | Not in model methods — `compute_tier()` is the sole authority |
| Frontend types | `lib/types.ts` → `StoryDetail`, `CATEGORY_MAP`, etc. | Not redefined locally in page components |
| Frontend API calls | `lib/api.ts` → `fetchStories()`, `fetchStory()`, etc. | Not raw `fetch()` calls in page components |

### Deduplication

- Articles are deduped by URL (`Article.url` unique constraint).
- Content hash (`SHA-256 of normalized title+content`) provides secondary dedup.
- Stories are deduped by semantic similarity (cosine ≥ 0.80 within 72h window).

### Sanitization

HTML is sanitized **at ingestion time** via `nh3`, not at render time. The allowed tag set is defined in `core/services/scraper.py`. This is a security boundary — never bypass it.

---

## 3. Git Conventions

### Commit Messages

Format: `[Component] Action: Details`

```
[Backend] Fix: compute_tier velocity bug — single-source stories should be Wire
[Frontend] Feat: Add VelocityLeaderboard component to homepage
[Infra] Chore: Add celerybeat-schedule to .gitignore
[Docs] Update: Rewrite ARCHITECTURE.md to match V3 codebase
```

### Branch Strategy

- `main` — Deployable. All Vercel/Render builds trigger from here.
- `feat/*` — Feature branches. PR into main.
- `fix/*` — Bug fix branches. PR into main.

### What Not to Commit

- `celerybeat-schedule` (SQLite binary — add to `.gitignore`)
- `.env` (secrets — use `.env.example` as template)
- `node_modules/`, `__pycache__/`, `.next/`

---

## 4. Testing Standards

### Backend

- **Framework**: pytest + pytest-django
- **Config**: `pytest.ini` in backend root
- **Coverage targets**:
  - Every API endpoint: success case + auth failure case
  - `compute_tier()`: all tier boundaries (Wire/Developing/Corroborated)
  - `cluster_article()`: match vs. new-story creation
  - Scraper: RSS parsing with mocked feed data

### Frontend

- **Framework**: Jest + React Testing Library (when implemented)
- **Priority components**: StoryCard, CorroborationMeter, VelocityLeaderboard, FeedPage

---

## 5. Deployment Protocol

1. Push to `main`
2. Vercel auto-deploys frontend
3. Render auto-deploys backend + workers
4. Verify via `/api/v1/health` endpoint
5. Check worker logs for OOM or embedding failures
6. Monitor first ingestion cycle after deploy

### Post-Deploy Checklist

```bash
# Health check
curl https://your-app.onrender.com/api/v1/health

# Verify source registry
curl https://your-app.onrender.com/api/v1/sources | python -m json.tool | head -20

# Verify frontend rendering
open https://ultra-news.vercel.app
```

### Rollback

Vercel: Instant rollback via deployment history.
Render: Redeploy previous commit from dashboard.
Database: Migrations are forward-only. Plan schema changes carefully.

---

## 6. Makefile Conventions

The Makefile is the canonical developer interface. All common operations should be accessible via `make <target>`.

### Rules

- **DRY**: Use `COMPOSE`, `BACKEND_EXEC`, and `FRONTEND_DIR` variables — don't repeat `docker compose exec backend` in every target.
- **`.PHONY`**: Declare all targets as phony (they don't produce files).
- **User feedback**: Print success/failure messages and next-step hints. `make seed` should tell the user what happened.
- **Destructive operations**: Separate `clean` (safe — removes containers) from `nuke` (destructive — removes volumes and data). Warn the user.
- **`help` as default**: `make` with no arguments shows all available commands.
