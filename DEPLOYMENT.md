# 🚀 Deployment Guide: Vercel + Render

This guide outlines the exact production setup for Ultra News, splitting the **Frontend** (Next.js) to **Vercel** and the **Backend** (Django/Redis/Postgres) to **Render**.

---

## ✅ Prerequisites

1.  **Accounts**:
    *   [GitHub](https://github.com/) (Contains your repository)
    *   [Vercel Account](https://vercel.com/) (For Frontend)
    *   [Render Account](https://render.com/) (For Backend + DB)
2.  **Repo**: Ensure your code is pushed to a GitHub repository.

---

## Part 1: Backend Deployment (Render)

We will deploy the Django API, PostgreSQL Database, Redis, and Celery Worker on Render.

### 1. Create Database & Redis
1.  Go to **Render Dashboard** -> **New +** -> **PostgreSQL**.
    *   Name: `ultra-news-db`
    *   Plan: Free (or Standard for production)
2.  Go to **New +** -> **Redis**.
    *   Name: `ultra-news-redis`
    *   Plan: Free (or Starter)

### 2. Deploy Django Web Service
1.  **New +** -> **Web Service** -> Connect your GitHub repo (`ultra-news`).
2.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Runtime**: Docker
    *   **Instance Type**: Free/Starter
3.  **Environment Variables**:
    *   `SECRET_KEY`: (Generate a random string)
    *   `DEBUG`: `0`
    *   `DATABASE_URL`: (Copy "Internal Database URL" from your Render Postgres dashboard)
    *   `REDIS_URL`: (Copy "Internal Redis URL" from your Render Redis dashboard)
    *   `CELERY_BROKER_URL`: (Same as `REDIS_URL`)
    *   `FRONTEND_URL`: `https://your-vercel-project.vercel.app` (Add later)
    *   `PORT`: `8000`

### 3. Deploy Celery Worker
1.  **New +** -> **Background Worker** -> Connect repo.
2.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Runtime**: Docker
    *   **Docker Command**: `celery -A config worker -l info`
3.  **Environment Variables**:
    *   Copy *all* variables from the Web Service (DATABASE_URL, REDIS_URL, etc.).

### 4. Deploy Celery Beat (Scheduler)
1.  **New +** -> **Background Worker** -> Connect repo.
2.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Runtime**: Docker
    *   **Docker Command**: `celery -A config beat -l info`
3.  **Environment Variables**:
    *   Copy *all* variables.
    *   *Note*: Beat triggers the scraper every 30 mins.

### 5. Scale & Optimization
*   **Persistent Storage**: Render's ephemeral disks wipe on restart. The scraper does not store files locally (it uses the DB), so this is fine.
*   **Scraper Blocking**: If you encounter 403s, you may need a static outbound IP (Render Pro) or a proxy service.

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
| `NEXT_PUBLIC_API_URL` | The **Public Domain** of your Render Web Service (e.g. `https://ultra-news.onrender.com`) |

### 4. Deploy
Click **Deploy**. Vercel will build the frontend.

---

## Part 3: Connecting the Dots (CORS)

Once Vercel deploys, you will get a permanent URL (e.g., `https://ultra-news-alpha.vercel.app`).

1.  Go back to **Render** -> **Web Service** -> **Environment**.
2.  Update/Add `FRONTEND_URL` with your Vercel URL:
    ```
    https://ultra-news-alpha.vercel.app
    ```
3.  Render will redeploy.
4.  **Done!** Your Vercel frontend can now securely fetch data from your Render backend.

---

## 🛠 Troubleshooting

*   **Images not showing?**
    *   Ensure `FRONTEND_URL` in Render variables exactly matches the Vercel URL (no trailing slash).
*   **CORS Errors?**
    *   Check Browser Console. configuration in `settings.py` relies on `FRONTEND_URL` env var.
*   **Database connection fail?**
    *   Verify `DATABASE_URL` variable in Render is linked to the Postgres service.

---

## 🔐 Environment Variables Reference

### Backend (Render/VPS)

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
| `NEXT_PUBLIC_API_URL` | ✅ | Public URL of your backend API. | `https://your-service.onrender.com` |

> **Note**: `NEXT_PUBLIC_API_URL` must **NOT** have a trailing slash.

