# 🚀 Deployment Guide: Vercel + Railway

This guide outlines the exact production setup for Ultra News, splitting the **Frontend** (Next.js) to **Vercel** and the **Backend** (Django/Redis/Postgres) to **Railway**.

---

## ✅ Prerequisites

1.  **Accounts**:
    *   [GitHub](https://github.com/) (Contains your repository)
    *   [Vercel Account](https://vercel.com/) (For Frontend)
    *   [Railway Account](https://railway.app/) (For Backend + DB)
2.  **Repo**: Ensure your code is pushed to a GitHub repository.

---

## Part 1: Backend Deployment (Railway)

We will deploy the Django API, PostgreSQL Database, Redis, and Celery Worker on Railway.

### 1. Create Project & Database
1.  Go to **Railway Dashboard** -> **New Project** -> **Provision PostgreSQL**.
2.  Railway will modify the project and add a `PostgreSQL` service.
3.  Click **New** (top right) -> **Database** -> **Add Redis**.
4.  Now you have a DB and Redis running.

### 2. Deploy Django App Service
1.  Click **New** -> **GitHub Repo** -> Select `ultra-news`.
2.  **IMMEDIATELY** click on the new service card -> **Settings** -> Scroll down to **Root Directory**.
3.  Set Root Directory to: `/backend`
4.  Railway will re-build. It should auto-detect `Dockerfile` or `requirements.txt`.
    *   *Note*: Since we have a `Dockerfile` in `/backend`, Railway will utilize it.

### 3. Configure Environment Variables (Django)
Go to the **Variables** tab of your Django service and add:

| Variable | Value |
|----------|-------|
| `SECRET_KEY` | (Generate a random string) |
| `DEBUG` | `0` |
| `DATABASE_URL` | `${{PostgreSQL.DATABASE_URL}}` (Railway references this auto-magically) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `CELERY_BROKER_URL` | `${{Redis.REDIS_URL}}` |
| `FRONTEND_URL` | `https://your-vercel-project.vercel.app` (Add this later after Vercel deploy) |
| `PORT` | `8000` |

### 4. Start Command
In **Settings** -> **Deploy** -> **Start Command**:
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

### 5. Deploy Celery Worker (Optional but Recommended)
1.  Add a **New Service** -> **GitHub Repo** -> Select `ultra-news` (again).
2.  Set Root Directory: `/backend`.
3.  Set Start Command: `celery -A config worker -l info`.
4.  Copy all Environment Variables from the Main Django App variables (or use Railway's "Shared Variables").
### 6. Deploy Celery Beat (Scheduler)
1.  Add a **New Service** -> **GitHub Repo** -> Select `ultra-news`.
2.  Set Root Directory: `/backend`.
3.  Set Start Command: `celery -A config beat -l info`.
4.  Copy Environment Variables (same as Worker/Django).
5.  *Important*: Beat triggers the scraper every 30 mins to fetch new high-res images and articles.
*   The scraper uses a "Professional" User-Agent (Chrome 120) to mimic a real browser.
*   If you face 403 blocks on Railway, consider using a proxy service or a dedicated IP, though the current headers should work for most RSS feeds.

---


## Part 2: Frontend Deployment (Vercel)

Now we deploy the Next.js frontend to Vercel (CDN edge).

### 1. Import Project
1.  Go to **Vercel Dashboard** -> **Add New...** -> **Project**.
2.  Select your `ultra-news` repository.

### 2. Configure Build Settings
*   **Framework Preset**: Next.js (Default)
*   **Root Directory**: Click "Edit" and select `frontend`.

### 3. Environment Variables
Add the following variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | The **Public Domain** of your Railway Django Service (e.g. `https://web-production-xyz.up.railway.app`) |

### 4. Deploy
Click **Deploy**. Vercel will build the frontend.

---

## Part 3: Connecting the Dots (CORS)

Once Vercel deploys, you will get a permanent URL (e.g., `https://ultra-news-alpha.vercel.app`).

1.  Go back to **Railway** -> **Django Service** -> **Variables**.
2.  Update/Add `FRONTEND_URL` with your Vercel URL:
    ```
    https://ultra-news-alpha.vercel.app
    ```
3.  Railway will redeploy.
4.  **Done!** Your Vercel frontend can now securely fetch data from your Railway backend.

---

## 🛠 Troubleshooting

*   **Images not showing?**
    *   Ensure `FRONTEND_URL` in Railway variables exactly matches the Vercel URL (no trailing slash).
*   **CORS Errors?**
    *   Check Browser Console. configuration in `settings.py` relies on `FRONTEND_URL` env var.
*   **Database connection fail?**
    *   Verify `DATABASE_URL` variable in Railway is linked to the Postgres service.

---

## 🔐 Environment Variables Reference

### Backend (Railway/VPS)

| Variable | Required | Description | Example Value |
|:---|:---:|:---|:---|
| `SECRET_KEY` | ✅ | Django security key (large random string). | `django-insecure-...` |
| `DEBUG` | ✅ | Set to `0` for production safety. | `0` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string. | `postgres://user:pass@db:5432/db` |
| `REDIS_URL` | ✅ | Redis connection string. | `redis://redis:6379/1` |
| `CELERY_BROKER_URL` | ❌ | Defaults to `REDIS_URL` if not set. | `redis://redis:6379/1` |
| `FRONTEND_URL` | ✅ | URL of your deployed frontend (for CORS). | `https://your-app.vercel.app` |
| `PORT` | ❌ | Port to bind Gunicorn (Defaults to 8000). | `8000` |

### Frontend (Vercel)

| Variable | Required | Description | Example Value |
|:---|:---:|:---|:---|
| `NEXT_PUBLIC_API_URL` | ✅ | Public URL of your backend API. | `https://your-api.up.railway.app` |

> **Note**: `NEXT_PUBLIC_API_URL` must **NOT** have a trailing slash.

