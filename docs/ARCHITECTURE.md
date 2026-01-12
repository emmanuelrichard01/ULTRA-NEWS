# 🏗️ System Architecture: ULTRA-NEWS V2

## 1. High-Level Overview
ULTRA-NEWS V2 is a scalable, distributed news aggregation platform designed to separate concerns between data processing, API serving, and user interface. It replaces a legacy Django monolith.

## 2. Tech Stack (The "Scale-Up" Stack)
- **Backend:** Python 3.11+, Django 5.x, **Django Ninja** (for fast, typed REST APIs).
- **Frontend:** **Next.js 14** (App Router), TypeScript, Tailwind CSS.
- **Database:** PostgreSQL 15+ (Production), SQLite (Dev/CI only if explicitly needed).
- **Infrastructure:** Docker & Docker Compose (Containerization).
- **Asynchronous Processing:** Celery + Redis (for background scraping tasks).

## 3. Core Components
### A. The Data Layer (PostgreSQL)
- **Users:** Custom User Model (Auth).
- **Articles:** Title, Slug, Content, Source, URL, Published Date, Categories.
- **Sources:** Feed configurations (RSS URLs, scraping rules).

### B. The API Layer (Django Ninja)
- **Docs:** Auto-generated OpenAPI (Swagger) at `/api/docs`.
- **Auth:** JWT (JSON Web Tokens) or HttpOnly Cookies.
- **Endpoints:**
    - `GET /api/news`: List news with pagination and filters.
    - `POST /api/news/scrape`: Trigger a background scrape (Admin only).

### C. The Client Layer (Next.js)
- **Rendering:** Server-Side Rendering (SSR) for SEO-critical pages (Home, Article Detail).
- **State:** React Server Components (RSC) for data fetching.
- **Caching:** Next.js Data Cache for high performance.
