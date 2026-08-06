# Go Live — $0 deployment, step by step

A follow-along walkthrough for putting Ultra News in production at zero cost,
with every feature working. [DEPLOYMENT.md](DEPLOYMENT.md) is the reference;
this is the recipe.

**Time:** ~35 minutes, most of it waiting on the first Docker build.
**Cost:** $0. No card required at any step.
**You give up:** the live breaking-news ticker, unless you add free Redis in
[Step 9](#step-9--optional-turn-the-ticker-back-on). Nothing else.

| # | Step | Where | Time |
| --- | --- | --- | --- |
| 0 | [Generate secrets](#step-0--generate-your-secrets) | your machine | 1 min |
| 1 | [Database](#step-1--database-neon) | Neon | 3 min |
| 2 | [AI key](#step-2--ai-key-groq--optional) | Groq | 2 min |
| 3 | [API](#step-3--api-koyeb) | Koyeb | 12 min |
| 4 | [Seed sources](#step-4--seed-the-source-registry) | terminal | 1 min |
| 5 | [Pipeline](#step-5--pipeline-github-actions) | GitHub | 5 min |
| 6 | [Frontend](#step-6--frontend-vercel) | Vercel | 4 min |
| 7 | [Connect CORS](#step-7--connect-cors) | Koyeb | 2 min |
| 8 | [Verify](#step-8--verify) | terminal | 3 min |
| 9 | [Ticker](#step-9--optional-turn-the-ticker-back-on) | Upstash | optional |
| 10 | [Before you share it](#step-10--before-you-share-the-link) | — | 2 min |

> **Order matters.** The database must exist before the API, the API before you
> seed, and the seed before the pipeline runs — the pipeline has nothing to
> ingest until the source registry is populated.

---

## Step 0 — Generate your secrets

```bash
python -c "import secrets; print('SECRET_KEY      =', secrets.token_urlsafe(64))"
python -c "import secrets; print('ADMIN_API_KEY   =', secrets.token_urlsafe(32))"
python -c "import secrets; print('METRICS_TOKEN   =', secrets.token_urlsafe(24))"
python -c "import secrets; print('REVALIDATE_SECRET =', secrets.token_urlsafe(24))"
```

Keep these open in a scratch file. Each gets pasted into two places, and
mismatches between the two are the most common cause of a broken deploy.

`SECRET_KEY` is not optional theatre: with `DEBUG=0` and no key, the app
**refuses to start** rather than silently signing sessions with a default
committed to this repository.

---

## Step 1 — Database (Neon)

1. [neon.tech](https://neon.tech) → sign up → **New Project**, Postgres 16.
2. Open **SQL Editor** and run:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Connection Details** → copy the **Pooled** connection string.

Save it as `DATABASE_URL`. It looks like:

```text
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

**Take the pooled string, not the direct one.** Pooling is what keeps the
Actions runner's eight concurrent fetch threads inside the connection limit.

> Migration `0006` also issues `CREATE EXTENSION`, so step 2 is belt-and-braces.
> Do it anyway — if the role lacks permission you want to find out now, not
> during a migration.

---

## Step 2 — AI key (Groq) — optional

**Ultra News runs fully without this.** Briefs and Ask answers get assembled
from the retrieved source sentences and label themselves as extractive. It is a
supported mode, not a broken one.

That said, generated answers are the demo moment, and this tier is free:

1. [console.groq.com/keys](https://console.groq.com/keys) → sign in → **Create API Key**
2. Copy it (starts `gsk_`). Save as `LLM_API_KEY`.

Free allowance, verified from live response headers:

| Model | Requests/day |
| --- | --- |
| `llama-3.3-70b-versatile` (primary) | 1,000 |
| `llama-3.1-8b-instant` (fallback) | 14,400 |

The chain runs strongest-first. When the 70B model's daily budget is gone, the
8B model answers instead — so a busy day costs you some answer quality rather
than the whole feature.

---

## Step 3 — API (Koyeb)

[koyeb.com](https://koyeb.com) → **Create Web Service** → **GitHub** → your repo.

**Build settings**

| Field | Value |
| --- | --- |
| Builder | **Dockerfile** |
| Work directory | `backend` |
| Dockerfile location | `Dockerfile` |
| Instance | **Free** (512 MB, 0.1 vCPU) |
| Region | Washington DC *or* Frankfurt (free tier allows one) |
| Port | `8000` — **and check the health-check port matches** |
| Health check path | `/api/v1/health` |

**Leave the run command empty.** The Dockerfile's default already reads
`WEB_CONCURRENCY` and needs no flags.

**Environment variables**

```bash
DEBUG=0
SECRET_KEY=<step 0>
ADMIN_API_KEY=<step 0>
METRICS_TOKEN=<step 0>
DATABASE_URL=<step 1, pooled>
ALLOWED_HOSTS=<your-app>.koyeb.app

# No Redis on this path — verified: every endpoint serves without it.
CACHE_BACKEND=locmem

# Neon pools for us; a second pool on top is counterproductive.
DB_CONN_MAX_AGE=0
DB_DISABLE_SERVER_SIDE_CURSORS=1

# ONE worker. Each loads its own copy of the embedding model:
#   1 worker → 349 MiB     2 workers → 587 MiB
# 512 MB fits exactly one. This is the setting that decides whether the
# container lives or gets OOM-killed.
WEB_CONCURRENCY=1

# Global ceilings — one heavy visitor can spend the day for everyone.
MAX_ASK_DAILY_REQUESTS=100
MAX_SYNTHESIS_DAILY_REQUESTS=50

# Omit both for keyless mode.
LLM_PROVIDER=groq
LLM_API_KEY=<step 2>
```

Deploy. **The first build takes ~10 minutes** — it bakes the embedding model
into the image so that containers start without downloading anything and do not
depend on HuggingFace being reachable at boot.

Wait for **Healthy**, then note your URL: `https://<your-app>.koyeb.app`.

> If the build fails on memory, check you set `WEB_CONCURRENCY=1`. That is
> almost always what it is.

---

## Step 4 — Seed the source registry

```bash
curl -X POST https://<your-app>.koyeb.app/api/v1/admin/seed-db \
  -H "X-Admin-Key: <your ADMIN_API_KEY>"
```

Expect JSON listing categories and ~41 sources.

**Do this before Step 5.** The pipeline iterates active sources; with none
seeded it succeeds while doing nothing, which looks identical to working.

---

## Step 5 — Pipeline (GitHub Actions)

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add four:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled string (step 1) |
| `SECRET_KEY` | step 0 |
| `API_URL` | `https://<your-app>.koyeb.app` |
| `LLM_API_KEY` | step 2 — omit for keyless |

Then **Actions → Pipeline — ingest, cluster, momentum → Run workflow**.

Do not wait for the cron. This first manual run is what puts stories in your
database; it takes 2–4 minutes.

**What is now running on its own:**

| Workflow | Cadence | Does |
| --- | --- | --- |
| `pipeline.yml` | every 30 min | migrate → ingest → cluster → momentum → briefs |
| `maintenance.yml` | daily 04:17 | retention, source-health report |
| `keepalive.yml` | every 15 min | pings `/health` so Koyeb doesn't sleep |

**Why the compute runs on Actions.** The runner has 7 GB and four cores for
free; your API host has 512 MB and a tenth of a core. Embedding and clustering
are batch work, so they belong on the runner, and the API stays a small
read-mostly server that also answers `/ask`.

**Why `keepalive.yml` exists.** Koyeb's free instance scales to zero after one
hour idle and that threshold cannot be changed on the free tier. A cold start is
a container boot *plus* an ~11 s model load on 0.1 vCPU — so a recruiter opening
your link cold could wait a minute and conclude it is broken. A ping every 15
minutes keeps it inside the window. Delete this workflow if you ever move to a
paid instance.

---

## Step 6 — Frontend (Vercel)

[vercel.com](https://vercel.com) → **Add New → Project** → import your repo.

| Field | Value |
| --- | --- |
| Framework | Next.js (auto-detected) |
| **Root directory** | `frontend` |

Environment variables:

```bash
NEXT_PUBLIC_API_URL=https://<your-app>.koyeb.app
NEXT_PUBLIC_APP_URL=https://<your-app>.vercel.app
```

> **No trailing slash on `NEXT_PUBLIC_API_URL`.**
> `https://x.koyeb.app` ✅  `https://x.koyeb.app/` ❌

Deploy, and note your Vercel URL.

---

## Step 7 — Connect CORS

Back in **Koyeb → your service → Environment**, add:

```bash
FRONTEND_URL=https://<your-app>.vercel.app
SITE_URL=https://<your-app>.vercel.app
```

Redeploy.

**Skipping this is the single most common cause of "the site loads but shows no
stories."** The browser blocks the response, the API logs look perfectly
healthy, and nothing anywhere says "CORS" unless you open the browser console.

`SITE_URL` is separate on purpose: it builds the absolute links inside your
outbound RSS feeds. Leave it wrong and your feed items point at the wrong host.

---

## Step 8 — Verify

```bash
API=https://<your-app>.koyeb.app

# 1. Health. 503 (not 200) when degraded, so uptime checks work without
#    parsing the body.
curl -s $API/api/v1/health

# 2. Stories exist
curl -s "$API/api/v1/stories?limit=3"

# 3. All three editions return DIFFERENT orderings
curl -s "$API/api/v1/stories?sort=momentum&limit=3"
curl -s "$API/api/v1/stories?sort=significance&limit=3"

# 4. Sources seeded and healthy
curl -s $API/api/v1/sources

# 5. Admin auth actually refuses
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/api/v1/admin/seed-db
# Expect: 401

# 6. Metrics locked down
curl -s -o /dev/null -w "%{http_code}\n" $API/metrics
# Expect: 401 or 403 — NOT 200
```

Then open your Vercel URL and:

- [ ] The Wire shows stories with corroboration counts
- [ ] Developing and The Record show **different** orderings
- [ ] A story page opens with a brief and a source ledger
- [ ] Ask the Wire Room returns an answer

---

## Step 9 — Optional: turn the ticker back on

Everything works without Redis. Measured, with Redis unreachable, every endpoint
returned 200: the three editions, sources, RSS, `/ask`, and the SSE stream.

The one real difference is the live ticker. Compared side by side:

| | With Redis | Without |
| --- | --- | --- |
| `/api/v1/stream` | `event: new_story` with payloads | connects, pings, no events |

The stream still opens and holds — it simply never announces anything. Two
smaller effects: feed-count cache entries are not pattern-purged, so counts can
lag their TTL; and the daily spend counters live in process memory, so they
reset on redeploy rather than at midnight.

To restore it: create a free [Upstash](https://upstash.com) Redis database, then
in Koyeb **remove** `CACHE_BACKEND=locmem` and add:

```bash
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
```

---

## Step 10 — Before you share the link

- [ ] **Rotate every key that has been pasted into a chat, issue, or screenshot.**
      Generate fresh ones and update both Koyeb and your GitHub secrets.
- [ ] `curl -s $API/api/v1/health` returns **200**, not 503
- [ ] `curl -s -o /dev/null -w "%{http_code}" $API/metrics` is **not** 200
- [ ] `DEBUG=0` in Koyeb
- [ ] Run the pipeline once more so the front page is fresh
- [ ] Open the site on a phone
- [ ] Confirm `.env` is not in your repo: `git ls-files --error-unmatch .env`
      should print an error

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Site loads, no stories | `FRONTEND_URL` unset or mismatched | Step 7. Check the browser console for CORS. |
| Container OOM-killed | `WEB_CONCURRENCY` > 1 | Set it to `1`. Two workers need 587 MiB. |
| Boot loop: `TCP health check failed on port 8080`, logs otherwise clean | Platform health-checks a different port than the app binds | The image now honours `$PORT`, so this resolves itself on a rebuild. On an older image, set the exposed port to `8000` in the platform settings. Note the logs say `Application startup complete` every time — the app is fine; nothing is listening where the checker is looking. |
| App refuses to start | `SECRET_KEY` unset with `DEBUG=0` | By design. Set it. |
| `relation "core_story" does not exist` | Migrations never ran | Run the Pipeline workflow — its first step is `migrate`. |
| Pipeline succeeds, ingests 0 | Sources not seeded | Step 4, then re-run. |
| Everything empty after seeding | Cron hasn't fired | Run the workflow manually; GitHub's scheduler lags. |
| First visit takes a minute | Instance had slept | Confirm `API_URL` secret is set so `keepalive.yml` runs. |
| Ask returns extractive only | No key, or quota spent | Working as designed. Check Actions logs for `429`. |
| `/metrics` returns 200 publicly | `METRICS_TOKEN` unset | Set it and redeploy. |
| Vector/embedding errors on migrate | pgvector missing | Step 1's `CREATE EXTENSION`. |

**Reading the logs.** Koyeb → service → **Logs** for the API; GitHub → Actions →
the failing run for the pipeline. A red pipeline run means *every* source
failed, which is a network or registry problem — one publisher having a bad
afternoon does not fail the run.

---

## What this costs at scale

At ~9.2 KB per article, Neon's free 0.5 GB holds roughly **50,000 articles**.
Retention is tiered and runs daily, so it stays under indefinitely. To tighten
it, set in Koyeb *and* as Actions secrets:

```bash
RETENTION_RAW_DOCUMENT_DAYS=3
RETENTION_ARTICLE_PAYLOAD_DAYS=14
RETENTION_UNCORROBORATED_STORY_DAYS=30
```

Check headroom any time with `python manage.py retention` (dry run).
