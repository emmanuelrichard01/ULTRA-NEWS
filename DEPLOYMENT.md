# Deployment Guide

> **Paid path:** Vercel (frontend) + Render (backend, workers, DB, Redis).
> **[$0 path](#the-0-path--full-features-nothing-given-up):** Vercel, Koyeb, Neon and GitHub Actions — every feature, `/ask` included, at no cost.
>
> Following along rather than looking something up? Use **[GO-LIVE.md](GO-LIVE.md)**.

---

## Prerequisites

| Requirement | Notes |
| ------------- | ------- |
| GitHub repository | Code pushed to `main` |
| [Vercel account](https://vercel.com/) | Frontend hosting |
| [Render account](https://render.com/) | Backend + infrastructure |

---

## Part 1: Infrastructure (Render)

### 1.1 PostgreSQL Database

1. Render Dashboard → **New +** → **PostgreSQL**
   - Name: `ultra-news-db`
   - PostgreSQL Version: 16
   - Plan: Standard (≥1GB RAM recommended for vector operations)

2. **After creation**, connect via the Shell tab or `psql` and enable pgvector:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

> [!IMPORTANT]
> The `vector` extension is required for semantic clustering. Without it, the `VectorField` columns will fail on migration and all embedding-based features (clustering, RAG search, related stories) will be non-functional.

3. Copy the **Internal Database URL** — you'll need it for environment variables.

### 1.2 Redis

1. Render Dashboard → **New +** → **Redis**
   - Name: `ultra-news-redis`
   - Plan: Starter or Standard

2. Copy the **Internal Redis URL**.

---

## Part 2: Backend Services (Render)

You need three Render services from the same codebase. They share environment variables but run different commands.

### 2.1 Django API (Web Service)

1. **New +** → **Web Service** → Connect GitHub repo
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Instance Type**: Standard (≥1GB RAM — fastembed loads a 384d ML model into memory)
3. Environment Variables:

| Variable | Value | Notes |
| :--- | :--- | :--- |
| `SECRET_KEY` | `$(openssl rand -hex 32)` | Generate a strong random key |
| `DEBUG` | `0` | **Must be 0 in production** |
| `ALLOWED_HOSTS` | `your-app.onrender.com` | Your Render domain |
| `ADMIN_API_KEY` | `$(openssl rand -hex 24)` | For protected admin endpoints |
| `DATABASE_URL` | *(from step 1.1)* | Internal Database URL |
| `REDIS_URL` | *(from step 1.2)* | Internal Redis URL |
| `CELERY_BROKER_URL` | *(same as REDIS_URL)* | Celery message broker |
| `CELERY_RESULT_BACKEND` | *(same as REDIS_URL)* | Celery task results |
| `FRONTEND_URL` | *(set after Vercel deploy)* | For CORS headers |

### 2.2 Celery Worker (Background Worker)

1. **New +** → **Background Worker** → Connect same repo
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Docker Command**: `celery -A config worker -l info --concurrency=2`
   - **Instance Type**: Standard (≥1GB RAM for embedding generation)
3. **Environment Variables**: Copy all variables from the Web Service.

### 2.3 Celery Beat Scheduler (Background Worker)

1. **New +** → **Background Worker** → Connect same repo
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Docker Command**: `celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler`
3. **Environment Variables**: Copy all variables from the Web Service.

---

## Part 3: Initialize Data

After the backend Web Service shows "Live":

```bash
# Seed categories and sources (requires API key)
curl -X POST https://your-app.onrender.com/api/v1/admin/seed-db \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY"
```

Expected response:
```json
{
  "status": "completed",
  "categories": ["Tech: Created", "Politics: Created", "Sports: Created", ...],
  "sources": ["Reuters: Created", "AP News: Created", "The Guardian: Created", ...],
  "deactivated": ["AllAfrica: Deactivated", ...]
}
```

> [!NOTE]
> The seed endpoint reads from `core/source_registry.py`, which defines 35+ sources with tier and region metadata. Sources marked as inactive in the registry are auto-deactivated during seeding.

---

## Part 4: Frontend (Vercel)

### 4.1 Import Project

1. Vercel Dashboard → **Add New...** → **Project**
2. Select your `ultra-news` repository

### 4.2 Configure

- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Environment Variables**:

| Variable | Value |
| ---------- | ------- |
| `NEXT_PUBLIC_API_URL` | `https://your-app.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | `https://ultra-news.vercel.app` |

> [!WARNING]
> `NEXT_PUBLIC_API_URL` must **not** have a trailing slash. `https://your-app.onrender.com` ✅ `https://your-app.onrender.com/` ❌

### 4.3 Deploy

Click **Deploy**. Vercel builds the frontend and assigns a URL.

---

## Part 5: Connect CORS

1. Copy your Vercel URL (e.g., `https://ultra-news.vercel.app`)
2. Go to Render → Web Service → Environment
3. Set `FRONTEND_URL` to the Vercel URL
4. Render auto-redeploys. Frontend can now fetch from backend.

---

## Verification Checklist

After deployment, verify each layer:

```bash
# 1. Health — returns 503 (not 200) when degraded, so uptime checks work
#    without parsing the body. Reports db, cache, ingest freshness,
#    clustering backlog and failing source count.
curl https://your-app.onrender.com/api/v1/health

# 2. Source registry — 41 sources with tier, region and live health
curl https://your-app.onrender.com/api/v1/sources | python -m json.tool | head -30

# 3. Auth — should return 401 without key
curl -X POST https://your-app.onrender.com/api/v1/admin/seed-db
# Expected: 401 Unauthorized

# 4. Auth — should return 200 with key
curl -X POST https://your-app.onrender.com/api/v1/admin/seed-db \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY"
# Expected: 200 OK

# 5. Frontend — open in browser
open https://ultra-news.vercel.app
```

---

## Environment Variables Reference

### Backend (Render — all three services)

| Variable | Required | Description |
| :--- | :---: | :--- |
| `SECRET_KEY` | ✅ | Django security key (random, 64+ chars) |
| `DEBUG` | ✅ | `0` for production |
| `ALLOWED_HOSTS` | ✅ | Comma-separated hostnames |
| `ADMIN_API_KEY` | ✅ | Admin endpoint authentication (random, 48+ chars) |
| `DATABASE_URL` | ✅ | PostgreSQL connection (internal URL) |
| `REDIS_URL` | ✅ | Redis connection (internal URL) |
| `CELERY_BROKER_URL` | ✅ | Same as `REDIS_URL` |
| `CELERY_RESULT_BACKEND` | ✅ | Same as `REDIS_URL` |
| `FRONTEND_URL` | ✅ | Vercel URL for CORS |

### Frontend (Vercel)

| Variable | Required | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL (no trailing slash) |
| `NEXT_PUBLIC_APP_URL` | — | Public app URL (for meta tags, OG) |

---

## Operational Notes

### Resource Requirements

Every process that embeds — the API (for `/ask`) and the Celery workers — loads
its own copy of `bge-small-en-v1.5`. Measured, with the model loaded and an
embedding performed:

| Configuration | Resident |
| --- | --- |
| One process | **349 MiB** |
| Two gunicorn workers | **587 MiB** |

So `WEB_CONCURRENCY` is the setting that decides whether the container fits its
memory limit, and it defaults to `1` for that reason. A 512 MB host runs the
full app including `/ask`; raise the worker count only alongside the memory.

The model is baked into the image at build time, so containers download nothing
at boot and do not depend on HuggingFace being reachable.

### Scaling

| Bottleneck | Solution |
| ----------- | ---------- |
| Ingestion throughput | Increase `--concurrency` on the Celery Worker |
| API response latency | Redis cache TTL, conditional GET (ETag/304), and materialised ranking columns — momentum is a stored value, not a per-request aggregate. |
| Database query speed | pgvector HNSW index (`vector_cosine_ops`), installed by migration `0016`. The ANN shortlist reuses the distance from the query rather than recomputing it. |
| Frontend TTFB | Vercel Edge caching via ISR (currently 60s revalidation) |
| Source pool diversity | Add sources to `core/source_registry.py` and re-seed |

### Troubleshooting

| Symptom | Likely Cause | Fix |
| --------- | ------------- | ----- |
| CORS errors in browser | `FRONTEND_URL` not set or has trailing slash | Set exact Vercel URL in Render env |
| Health check shows `degraded` | Database or Redis connection lost | Check Render dashboard for service status |
| No new articles after deployment | Celery Beat not running or Worker OOM'd | Check Background Worker logs in Render |
| Images not loading | `og:image` extraction failed during ingestion | Check worker logs for `trafilatura` errors |
| All stories stuck on Wire | Source pool too narrow for cross-outlet overlap | Add wire service sources (Reuters, AP) and re-seed |
| Seed returns empty sources | `source_registry.py` not found or import error | Check backend logs for Python import errors |

---

## Required in production

The app **refuses to start** without these when `DEBUG=0`. That is deliberate —
they previously fell back to values committed to this repository.

| Variable | Why it is not optional |
| :--- | :--- |
| `SECRET_KEY` | Signs sessions and CSRF tokens. A default here is a forgery primitive. |
| `GITHUB_OIDC_REPOSITORY` | Without it OIDC auth is refused outright. A valid GitHub Actions token only proves the request came from GitHub — not from *your* workflow. Unset, any workflow in any repo could call the admin endpoints. |

Also review before going live:

| Variable | Note |
| :--- | :--- |
| `TRUST_PROXY_HEADERS` | Set to `1` **only** behind a proxy that overwrites `X-Forwarded-For`. Enabled without one, anyone bypasses rate limiting by sending the header. |
| `SITE_URL` | Public origin for RSS links. Distinct from `NEXTJS_URL`, which is internal — using the internal one published feed items linking to `http://frontend:3000`. |
| `IMAGE_HOST_ALLOWLIST` | Never `**`. That makes the deployment an open image proxy. |
| `METRICS_TOKEN` / `METRICS_ALLOWED_IPS` | `/metrics` exposes internal state. Lock it down unless the port is private. |
| `PROMETHEUS_MULTIPROC_DIR` | **Required** under `gunicorn --workers N`, or a scrape returns whichever worker answered it. |

## Choosing an AI provider

A working config is **two variables**. Presets supply the base URL, the model
and the fallback chain, so you never hand-write a model id:

```bash
LLM_PROVIDER=groq
LLM_API_KEY=<key>
```

| Provider | Free allowance | Notes |
| --- | --- | --- |
| **`groq`** *(default)* | ~14,400 req/day on `llama-3.1-8b-instant` | No card. The only tier generous enough for a public demo. |
| `cerebras` | comparable | Same OpenAI-compatible shape. |
| `openrouter` | smaller | Access to `:free` model slugs. |
| `gemini` | generous per-minute, small per-day | Fine locally; a public demo exhausts it. |
| `openai` | — | Paid. |
| `ollama` | — | Local. Needs `LLM_BASE_URL` + `LLM_MODEL`. |
| `none` | — | Keyless. See below. |

Each preset defines a **chain**, not a single model, and the ordering is
deliberate: the strong model with a small daily allowance comes first, the
weaker model with a large allowance last. On a free tier the binding limit is
requests-per-day *per model*, so when the good model's budget is gone the
product keeps answering at reduced quality instead of losing the feature.

> Leave `LLM_MODEL` and `LLM_FALLBACK_MODELS` **blank** unless you mean to
> override. Pointing them at a model belonging to a different provider is the
> classic misconfiguration: every call 404s while the key looks perfectly valid.

### Running without any AI provider

Ultra News is fully usable with **no AI configuration at all**. Leave
`LLM_API_KEY` empty (or set `LLM_PROVIDER=none`) and briefs and answers are
assembled from the retrieved sources directly. This is a supported mode, not a
degraded one — self-host the whole product with zero inference spend.

To use a local model instead of a cloud vendor:

```bash
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1
LLM_API_KEY=            # local servers usually need no key
```

## Scale and storage

Measured at ~9.2 KB per article and ~3.7 KB per raw document — roughly
**3.3 GB/year** at 1,000 articles a day. Retention is tiered and on by default:

```bash
python manage.py retention          # report + dry run
python manage.py retention --apply  # release
```

Set `RETENTION_ENABLED=0` to keep a permanent archive.

Behind pgbouncer in **transaction** pooling mode, set both:

```bash
DB_CONN_MAX_AGE=0                  # let the pooler own connection reuse
DB_DISABLE_SERVER_SIDE_CURSORS=1   # incompatible with transaction pooling
```

## After deploying

```bash
# Verify every feed in the registry actually resolves. Exits non-zero on failure.
python manage.py validate_sources --fail-fast

# One-off, only when upgrading past the text-extraction fix.
python manage.py reclean_text --apply
```

## Monitoring

Alert on **`ultranews_articles_pending_clustering`** first. Articles are
invisible to readers until clustered, so a rising backlog means the product is
silently going stale while every request still returns 200 — no request-level
check reveals it.

`/api/v1/health` returns 503 when degraded and reports the same signals for
platforms that only do HTTP checks.

---

## The $0 path — full features, nothing given up

Ultra News runs at genuinely zero cost **with every feature working**, including
Ask the Wire Room. This is the configuration to use for a portfolio deployment
that people will actually click on.

> Free-tier limits move. The numbers below were current at time of writing —
> confirm them before you commit.

### The memory question, measured

The thing that decides whether `/ask` survives on a free tier is the embedding
model. Measured, with `bge-small-en-v1.5` loaded and an embedding performed:

```text
peak RSS, API process ................ 305 MB
live container, serving traffic ...... 349 MB
```

That fits a 512 MB instance with headroom. An earlier version of this guide
claimed ~1 GB and told you to drop `/ask` on free tiers — that was wrong, and it
gave up a feature that didn't need giving up.

### The stack

```text
GitHub Actions (cron)            Neon                    Vercel
  ingest + cluster + embed ────▶  Postgres + pgvector ◀─── Next.js frontend
  7 GB RAM, free                  free tier                     │
                                        ▲                       │
                                        │                       ▼
                                   Koyeb free ◀────────── Django API
                                   512 MB, no sleep        + embedding model
                                                           + /ask
```

| Layer | Free option | Why this one |
| --- | --- | --- |
| API | **Koyeb** free web service (512 MB) | Does **not** sleep, unlike Render free. Fits the 349 MB footprint. |
| Postgres + pgvector | **Neon** free | pgvector included. Auto-suspends when idle; wakes in well under a second. |
| Batch compute | **GitHub Actions** cron | 7 GB RAM, free and unlimited on public repos. Ideal for scheduled batch work. |
| Frontend | **Vercel** free | Generous; the app is mostly RSC + static. |
| Cache | **Upstash** free, or none | See below — Redis is genuinely optional. |
| AI | Your own Gemini key, or none | Keyless still answers, just extractively. |

**Why split compute this way.** Embedding and clustering are batch work that
wants a lot of RAM for a few minutes. Serving is interactive work that wants a
little RAM all the time. Free tiers are bad at the first and fine at the second,
so put the batch work on Actions and keep the API small.

### Redis: optional

Verified — the API serves `/health`, `/stories` and `/sources` on Django's
in-memory cache, and the Redis-backed extras (breaking ticker, pattern
invalidation) degrade quietly rather than erroring.

```bash
CACHE_BACKEND=locmem   # single-process only
```

Correct on one process. With Upstash's free tier you get shared caching and the
live ticker back; without it, the ticker is silent and nothing else changes.

### Koyeb: the API

Deploy from the repo, Dockerfile build, `backend/` as context.

```bash
DEBUG=0
SECRET_KEY=<generate a long random string>
ALLOWED_HOSTS=<your-app>.koyeb.app
DATABASE_URL=<neon pooled connection string>
FRONTEND_URL=https://<your-app>.vercel.app
SITE_URL=https://<your-app>.vercel.app

# Neon pools connections for you.
DB_CONN_MAX_AGE=0
DB_DISABLE_SERVER_SIDE_CURSORS=1

# One process, so in-memory cache is correct.
CACHE_BACKEND=locmem

# Optional — omit and answers are assembled from sources instead.
# groq is the default: 14,400 requests/day free, no card. The preset supplies
# the base URL, the model and the fallback chain.
LLM_PROVIDER=groq
LLM_API_KEY=<console.groq.com/keys>

# One worker. Each loads its own copy of the embedding model — measured at
# 349 MiB for one and 587 MiB for two, so two does not fit 512 MB.
WEB_CONCURRENCY=1

# Keep the daily ceilings low on a public demo. They are GLOBAL, so one heavy
# visitor can spend the day's budget for everyone.
MAX_ASK_DAILY_REQUESTS=100
MAX_SYNTHESIS_DAILY_REQUESTS=50

METRICS_TOKEN=<random string>
```

Leave the run command alone — the Dockerfile's default already reads
`WEB_CONCURRENCY` and needs no flags.

One worker is not only a memory constraint: it also makes `CACHE_BACKEND=locmem`
correct and lets you skip `PROMETHEUS_MULTIPROC_DIR`.

The embedding model is **baked into the image at build time**, so a booting
container downloads nothing and does not depend on HuggingFace being reachable.
It still costs ~11 s to load into memory on a full core, and longer on 0.1 vCPU.

### Scale-to-zero, and why it matters here

Koyeb's Free Instance **scales to zero after 1 hour with no traffic**, and that
threshold cannot be changed on the free tier. A visitor arriving cold therefore
waits for a container start *plus* the model load — a minute or more.

For a portfolio deployment that is the whole problem: someone opens the link
once, and a blank minute reads as broken rather than as thrifty.

`.github/workflows/keepalive.yml` pings `/api/v1/health` every 15 minutes, which
keeps the instance inside its idle window. Set the `API_URL` repository secret
to enable it; leave it unset and the workflow no-ops. Delete the workflow if you
move to a paid instance.

> Render's free tier sleeps after **15 minutes**, not 60, which is why Koyeb is
> the recommendation here despite both having a sleep behaviour.

The image is ~1 GB against a 2 GB instance disk, so it fits with room but not
lavishly — watch it if you add heavy dependencies. Koyeb builds remotely;
nothing is uploaded from your machine.

### GitHub Actions: the pipeline

Two workflows are committed and need no editing:

| File | Schedule | Does |
| --- | --- | --- |
| `.github/workflows/pipeline.yml` | every 30 min | migrate, ingest, cluster, refresh momentum |
| `.github/workflows/maintenance.yml` | daily | retention, source-health report |

Set two repository secrets — **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | the Neon connection string |
| `SECRET_KEY` | any long random string |
| `LLM_API_KEY` | optional; omit and briefs fall back to extraction |

Then **Actions → Pipeline → Run workflow** to populate the database immediately
rather than waiting for the first cron tick.

**Why the compute runs here rather than on the API.** The runner has 7 GB and
four cores for free; the API host has 512 MB and a fraction of one. Embedding and
clustering are batch work, so they belong on the runner, and the API stays a
small read-mostly server that also answers `/ask`. An earlier version of this
project POSTed to an admin endpoint on a timer and made the web tier do it — that
inverts the resource picture and blocks request handling while it runs.

Both workflows run `manage.py run_pipeline`, which does ingest → cluster →
momentum **in one process**. That ordering is not optional — clustering must see
what ingestion just wrote, and momentum must see the clusters — and one process
means the ~11 s model load is paid once instead of three times.

> `manage.py ingest_news` is **not** the command to use here. It calls `.delay()`,
> so with no Celery worker it enqueues into nothing and reports success.

Note that momentum **decays with the clock, not with writes**: a story that drew
ten outlets thirteen hours ago has zero momentum now, and nothing touched its
row to say so. Without the periodic refresh, stale stories stay pinned to the
Developing edition.

GitHub's scheduler is best-effort and lags under load — treat 30 minutes as a
floor, not a guarantee. Both workflows take a `concurrency` lock, so a slow run
cannot race the next tick.

## Staying inside the free database

At ~9.2 KB per article, a 0.5 GB database holds roughly **50,000 articles**.
Retention keeps you under indefinitely; tighten it for a small tier:

```bash
RETENTION_RAW_DOCUMENT_DAYS=3
RETENTION_ARTICLE_PAYLOAD_DAYS=14
RETENTION_UNCORROBORATED_STORY_DAYS=30
```

Check headroom with `python manage.py retention`.

### What you actually give up

| | Reality |
| --- | --- |
| Features | **None.** Clustering, corroboration, all three editions, topics, story pages, RSS and `/ask` all work. |
| Freshness | Capped by the cron interval — ~30 min instead of 15. |
| Ticker | Silent without Redis. Add Upstash free to restore it. |
| Cold starts | Koyeb sleeps after 1 hour idle. The keepalive workflow prevents it; without that, expect a minute-plus first load. |
| AI quota | Groq's free tier is ~14,400 requests/day, far past what a portfolio demo draws. Past it, answers degrade to extractive rather than failing. Keep the daily ceilings low so degradation is predictable rather than a surprise. |

### Before you share the link

```bash
python manage.py validate_sources --fail-fast   # every feed resolves
curl -s https://<api>/api/v1/health             # expect 200, not 503
```

Seed the database once via `/admin/seed-db` with your `ADMIN_API_KEY`, then run
the Actions workflow manually so there are stories to look at before anyone
arrives.
