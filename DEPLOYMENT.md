# 🚀 Deployment Guide: Vercel + Render

This guide outlines the production setup for Ultra News, splitting the **Frontend** (Next.js) to **Vercel** and the **Backend** (Django/Redis/Postgres) to **Render**.

---

## ✅ Prerequisites

1.  **Accounts**:
    *   [GitHub](https://github.com/) (Contains your repository)
    *   [Vercel Account](https://vercel.com/) (For Frontend)
    *   [Render Account](https://render.com/) (For Backend + DB)
2.  **Repo**: Ensure your code is pushed to a GitHub repository.

---

## Part 1: Backend Deployment (Render)

We will deploy the Django API, PostgreSQL Database, and Redis on Render.

### 1. Create Database & Redis

1.  Go to **Render Dashboard** → **New +** → **PostgreSQL**.
    *   Name: `ultra-news-db`
    *   Plan: Free (or Standard for production)
2.  Go to **New +** → **Redis**.
    *   Name: `ultra-news-redis`
    *   Plan: Free (or Starter)

### 2. Deploy Django Web Service

1.  **New +** → **Web Service** → Connect your GitHub repo (`ultra-news`).
2.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Runtime**: Docker
    *   **Instance Type**: Free/Starter
3.  **Environment Variables**:

| Variable | Value | Notes |
|:---|:---|:---|
| `SECRET_KEY` | (Generate random string) | Use a password generator |
| `DEBUG` | `0` | **Critical**: Must be `0` in production |
| `ALLOWED_HOSTS` | `ultra-news.onrender.com` | Your Render domain |
| `ADMIN_API_KEY` | (Generate random string) | For protected admin endpoints |
| `DATABASE_URL` | (Copy from Postgres dashboard) | Use "Internal Database URL" |
| `REDIS_URL` | (Copy from Redis dashboard) | Use "Internal Redis URL" |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Add after Vercel deploy |
| `PORT` | `8000` | Optional, defaults to 8000 |

### 3. Post-Deployment: Initialize Data

After your backend service is deployed and "Live":

```bash
# Seed the database (requires API key now!)
curl -X POST https://<YOUR-RENDER-URL>.onrender.com/api/admin/seed-db \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY"
```

You should see a JSON response listing created categories and sources.

---

## Part 2: Frontend Deployment (Vercel)

### 1. Import Project
1.  Go to **Vercel Dashboard** → **Add New...** → **Project**.
2.  Select your `ultra-news` repository.

### 2. Configure Build Settings
*   **Framework Preset**: Next.js (Default)
*   **Root Directory**: Click "Edit" and select `frontend`.

### 3. Environment Variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://ultra-news.onrender.com` |

> **Note**: `NEXT_PUBLIC_API_URL` must **NOT** have a trailing slash.

### 4. Deploy
Click **Deploy**. Vercel will build the frontend.

---

## Part 3: GitHub Actions (Automated Ingestion)

GitHub Actions handles automatic news ingestion every 30 minutes.

### 1. Add Repository Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | Value |
|:---|:---|
| `INGEST_URL` | `https://ultra-news.onrender.com/api/admin/trigger-ingest` |
| `ADMIN_API_KEY` | (Same value as Render) |

### 2. Verify Workflow

The workflow file `.github/workflows/ingest.yml` is already configured. It will:
- Run every 30 minutes automatically
- Send authenticated `POST` request with `X-Admin-Key` header
- Trigger background news scraping

### 3. Manual Trigger

To test immediately:
1. Go to **Actions** tab in GitHub
2. Select "Trigger News Ingestion" workflow
3. Click **Run workflow**

---

## Part 4: Connecting the Dots (CORS)

Once Vercel deploys, you will get a permanent URL (e.g., `https://ultra-news-alpha.vercel.app`).

1.  Go back to **Render** → **Web Service** → **Environment**.
2.  Update/Add `FRONTEND_URL` with your Vercel URL:
    ```
    https://ultra-news-alpha.vercel.app
    ```
3.  Render will redeploy.
4.  **Done!** Your Vercel frontend can now securely fetch data from your Render backend.

---

## 🔒 Security Checklist

Before going live, verify these security measures:

- [ ] `DEBUG` is set to `0` in Render environment
- [ ] `ALLOWED_HOSTS` contains only your domain (not `*`)
- [ ] `ADMIN_API_KEY` is a strong, random string (32+ characters)
- [ ] GitHub secret `ADMIN_API_KEY` matches Render value
- [ ] `/api/admin/*` endpoints return `401` without proper header

### Test Security

```bash
# Should return 401 Unauthorized
curl -X POST https://ultra-news.onrender.com/api/admin/trigger-ingest

# Should return 200 OK  
curl -X POST https://ultra-news.onrender.com/api/admin/trigger-ingest \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY"
```

---

## 📊 Health Monitoring

The `/api/health` endpoint provides deep health checks:

```bash
curl https://ultra-news.onrender.com/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "db": "ok",
  "cache": "ok"
}
```

If any component fails, status will be `"degraded"` with error details.

---

## 🛠 Troubleshooting

### Admin endpoints return 401
- Verify `ADMIN_API_KEY` environment variable is set in Render
- Ensure `X-Admin-Key` header is included in requests
- Check that GitHub secret matches Render value exactly

### Images not showing
- Ensure `FRONTEND_URL` in Render variables exactly matches Vercel URL (no trailing slash)
- Check that images are being extracted during ingestion

### CORS Errors
- Verify `FRONTEND_URL` is set correctly in Render
- Check Browser Console for specific origin errors
- Ensure no trailing slash in URL

### Database connection fail
- Verify `DATABASE_URL` variable in Render is linked to the Postgres service
- Check Render Postgres dashboard for connection issues

### Health check shows "degraded"
- Check Render logs for specific error messages
- Verify Redis connection if cache shows error
- Restart the service if database connection is stale

---

## 🔐 Environment Variables Reference

### Backend (Render)

| Variable | Required | Description | Example |
|:---|:---:|:---|:---|
| `SECRET_KEY` | ✅ | Django security key | `dj-sk-abc123...` |
| `DEBUG` | ✅ | Must be `0` for production | `0` |
| `ALLOWED_HOSTS` | ✅ | Comma-separated hostnames | `ultra-news.onrender.com` |
| `ADMIN_API_KEY` | ✅ | Admin endpoint authentication | `un-admin-key-2025-xyz` |
| `DATABASE_URL` | ✅ | PostgreSQL connection | `postgres://...` |
| `REDIS_URL` | ✅ | Redis connection | `redis://...` |
| `FRONTEND_URL` | ✅ | Vercel URL for CORS | `https://app.vercel.app` |

### Frontend (Vercel)

| Variable | Required | Description |
|:---|:---:|:---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL (no trailing slash) |

### GitHub Actions

| Secret | Description |
|:---|:---|
| `INGEST_URL` | Full URL to trigger-ingest endpoint |
| `ADMIN_API_KEY` | Same value as Render environment |

---

## 📈 Optional: Scalable Production (Celery)

For high-traffic deployments, you can add Celery workers instead of GitHub Actions:

### Deploy Celery Worker
1.  **New +** → **Background Worker** → Connect repo.
2.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Runtime**: Docker
    *   **Docker Command**: `celery -A config worker -l info`
3.  Copy all environment variables from the Web Service.

### Deploy Celery Beat (Scheduler)
1.  **New +** → **Background Worker** → Connect repo.
2.  **Docker Command**: `celery -A config beat -l info`
3.  Copy all environment variables.

> **Note**: Background Workers are a paid feature on Render. The GitHub Actions approach works on the free tier.
