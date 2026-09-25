# Incident: Neon quotas — pipeline and retention failing, Aug 28 – Sep 25 2026

**Status:** fix in code, awaiting deploy · **Impact:** no new stories ingested
while the database refused writes; feeds progressively auto-disabled.

## Summary

The production database is Neon's free tier: **512 MB storage** and a monthly
**data-transfer** allowance. Both were exceeded, one after the other, and three
defects turned each quota into a sustained outage.

The initial hypothesis — "retention broke, so storage grew" — was the wrong way
round. The job logs show retention **succeeding daily from Sep 3 to Sep 9** while
storage kept growing; it only started failing on Sep 10, *because* the database
was already full.

## Timeline (UTC, from Actions logs and Neon alerts)

| When | What |
| --- | --- |
| Aug 28 – Sep 2 | Every run fails: `Your project has exceeded the data transfer quota` |
| Sep 1 | Neon billing month resets transfer |
| Sep 2 | Neon: 81% of storage used |
| Sep 3 – Sep 9 | Maintenance succeeds daily; storage still rising |
| Sep 8 12:53 | Neon: storage 100% |
| Sep 10 → | Maintenance fails daily: `could not extend file because project size limit (512 MB) has been exceeded` |
| Sep 24 – 25 | Pipeline fails every run with the same error; circuit breakers open on healthy feeds (`Circuit breaker OPEN for Politico after 12 failures: OperationalError: could not extend file…`) |

## Root causes

1. **Retention windows sized for a VPS, deployed on 512 MB.** Measured cost is
   ~9.2 KB per article row plus ~3.7 KB of raw text, at ~1,000 articles/day.
   Keeping payloads 45 days and single-source stories 90 days holds 400+ MB of
   article rows before indexes. The cap was arithmetic, not bad luck.
2. **Retention could not run at the cap.** Its steps ran in the order raw-text
   DELETE → payload UPDATE → story DELETE. A Postgres UPDATE writes a new row
   version before the old one is reclaimed, so it needs free space: it failed,
   raised, and the story DELETE — the largest single saving, and one that does
   *not* need space — never ran. Recovery required the thing that was exhausted.
3. **Our database errors were charged to publishers.** Ingestion's catch-all
   recorded every `OperationalError` as a failure of the feed being scraped;
   after 12, the circuit breaker **deactivated the source**. Freeing storage
   would not have brought those feeds back.
4. **De-duplication was the main draw on transfer (August).** Before each
   fetch, ingestion loaded *every URL the source had ever produced* — before the
   conditional GET, so even a `304 Not Modified` paid for it. Estimated at the
   archive sizes involved: 41 sources × ~2k URLs × ~110 bytes × 48 runs/day
   ≈ 0.4–0.5 GB/day from Actions runners to Neon, well past the monthly
   allowance on its own. (An estimate from row counts; Neon's console shows
   the actual transfer breakdown.)
5. **No early warning.** Nothing reported database size; the first signal was
   Neon's own "100% used" email.

## What changed

| Defect | Fix | Where |
| --- | --- | --- |
| 1 | Neon-sized windows in both workflows: raw text 3 d, payloads 14 d, single-source stories 10 d; `DATABASE_BUDGET_MB=512` | `.github/workflows/*.yml` |
| 2 | Retention reordered for a full disk: DELETEs → `VACUUM` → **batched** UPDATE. Each step isolated: a failure is recorded, the rest still run, then the job fails | `core/retention.py` |
| 2 | Pipeline detects a capacity error, runs retention immediately (not in up to 24 h), and exits with a message naming the cause | `run_pipeline.py` |
| 3 | Database errors are re-raised, never recorded against a feed | `core/tasks.py`, `core/storage.py` |
| 3 | Feeds disabled by our own database errors are reactivated automatically (by recorded reason; genuine HTTP/parse failures stay off) | `core/storage.py`, run by pipeline and maintenance |
| 4 | De-duplication is a lookup of *this feed's* URLs via the unique index, made only after a real 200 | `core/tasks.py`, `core/services/scraper.py` |
| 5 | `manage.py db_report` after every run: size vs budget table on the run summary, `::warning::` past 80% | both workflows |

All of it is covered by `core/tests/test_capacity.py`.

## Recovery runbook

1. **Deploy** the fix (merge to `main`).
2. **Run maintenance now** rather than waiting for 04:17 UTC:
   `gh workflow run maintenance.yml` then `gh run watch`.
   The DELETEs run first and do not need free space; `VACUUM` then makes the
   freed space reusable. Expect the step list to show counts, and the
   "reactivated N feeds" line.
3. **Check the size report** on that run's summary page. Physical size falls
   slowly — deleted space is reused, not returned — so the signal that matters
   is the next **pipeline** run succeeding, not the MB figure dropping.
4. **If even the DELETEs are refused** (not expected; they write in place), run
   in the Neon SQL editor, then re-run step 2:

   ```sql
   DELETE FROM core_rawdocument WHERE fetched_at < now() - interval '3 days';
   VACUUM core_rawdocument;
   ```

5. **Anything else running retention** — a Celery beat on the API host uses the
   code defaults (14/45/90 days). Set the same `RETENTION_*` variables there, or
   it will keep less-aggressive windows. It cannot undo the workflow's deletes,
   but it will not help either.

## After recovery (Sep 25)

Maintenance on the fixed code deleted 16,051 single-source stories, purged 2,934
raw documents, cleared 15,117 payloads and reactivated 9 feeds the breaker had
wrongly disabled; the next pipeline run ingested 798 articles with no failures.

On-disk size stayed at 92%: plain VACUUM makes freed space reusable but does not
shrink files. So `db_report` now measures **live data** separately and warns on
that, and maintenance runs `retention --apply --compact`, which rewrites a table
with VACUUM FULL only when the rewrite provably fits in current headroom
(smallest table first, so each success widens the room for the next).

## Follow-ups

- Watch the `db_report` summaries for a week; steady state should settle well
  under 60% of budget. If it does not, lower `RETENTION_ARTICLE_PAYLOAD_DAYS`
  first — it is the largest per-row cost.
- Check Neon's transfer graph for September against August to confirm the
  de-duplication change was the dominant term.
