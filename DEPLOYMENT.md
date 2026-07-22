# Deployment Guide — ULTRA-NEWS V3

> Vercel (Frontend) + Render (Backend, Workers, DB, Redis)

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
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
|:---|:---|:---|
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
|----------|-------|
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
# 1. Health check — should return {"status": "ok", "db": "ok", "cache": "ok"}
curl https://your-app.onrender.com/api/v1/health

# 2. Source registry — should return 35+ sources with tier/region data
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
|:---|:---:|:---|
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
|:---|:---:|:---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL (no trailing slash) |
| `NEXT_PUBLIC_APP_URL` | — | Public app URL (for meta tags, OG) |

---

## Operational Notes

### Resource Requirements

The Celery Worker loads the `bge-small-en-v1.5` embedding model (~100MB) into memory at startup. On Render's Free tier (512MB RAM), this will OOM. **Standard tier (1GB+) is the minimum for the worker.**

### Scaling

| Bottleneck | Solution |
|-----------|----------|
| Ingestion throughput | Increase `--concurrency` on the Celery Worker |
| API response latency | Redis cache TTL (currently 300s on detail endpoints) |
| Database query speed | pgvector HNSW index (not yet configured — IVFFlat default) |
| Frontend TTFB | Vercel Edge caching via ISR (currently 60s revalidation) |
| Source pool diversity | Add sources to `core/source_registry.py` and re-seed |

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| CORS errors in browser | `FRONTEND_URL` not set or has trailing slash | Set exact Vercel URL in Render env |
| Health check shows `degraded` | Database or Redis connection lost | Check Render dashboard for service status |
| No new articles after deployment | Celery Beat not running or Worker OOM'd | Check Background Worker logs in Render |
| Images not loading | `og:image` extraction failed during ingestion | Check worker logs for `trafilatura` errors |
| All stories stuck on Wire | Source pool too narrow for cross-outlet overlap | Add wire service sources (Reuters, AP) and re-seed |
| Seed returns empty sources | `source_registry.py` not found or import error | Check backend logs for Python import errors |
