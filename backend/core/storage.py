"""
Database capacity: recognising it, reporting it, and recovering from it.

Written after the September 2026 incident (docs/incidents/2026-09-neon-capacity.md).
The production database is Neon's free tier: 512 MB of storage and a monthly
data-transfer allowance. Both were exceeded — transfer in late August, storage
from 8 September — and three things turned a quota into a two-week outage:

  1. Retention could not run at the cap. Its first write was an UPDATE, which in
     Postgres writes a new row version before the old one is reclaimed: the
     step meant to free space needed free space first. It crashed, and the
     steps after it — including the one DELETE that would have freed the most —
     never ran.
  2. Ingestion blamed publishers. Every "could not extend file" from our own
     database was recorded as a failure of the feed being scraped, and after
     twelve the circuit breaker DEACTIVATED the source. Freeing storage would
     not have brought those feeds back.
  3. Nobody could see it coming. Nothing reported database size until Neon's
     own emails did.

This module is the shared vocabulary for all three.
"""
import logging
import os

from django.db import DatabaseError, connection

logger = logging.getLogger(__name__)

# Messages a managed Postgres returns when a QUOTA, not a query, is the problem.
# Matched as substrings, lower-cased: the driver wraps them in several layers.
CAPACITY_SIGNATURES = (
    "project size limit",          # Neon storage cap
    "could not extend file",       # any Postgres at a disk or size cap
    "data transfer quota",         # Neon egress cap
    "no space left on device",     # self-hosted disk full
    "diskfull",
)


def is_database_capacity_error(exc: BaseException) -> bool:
    """True when the database refused work because a quota is exhausted."""
    text = f"{type(exc).__name__} {exc}".lower()
    return any(sig in text for sig in CAPACITY_SIGNATURES)


def is_database_error(exc: BaseException) -> bool:
    """
    True for any failure of OUR database, as opposed to a publisher's feed.

    Walks the cause chain, because a DatabaseError is often re-raised inside
    something more generic by the time it reaches a broad `except`.
    """
    seen = 0
    while exc is not None and seen < 5:
        if isinstance(exc, DatabaseError) or is_database_capacity_error(exc):
            return True
        exc = exc.__cause__ or exc.__context__
        seen += 1
    return False


def budget_mb() -> int:
    """The storage the database may use, in MB. 0 means unbounded."""
    try:
        return int(os.environ.get("DATABASE_BUDGET_MB", "0") or 0)
    except ValueError:
        return 0


def database_report(top: int = 8) -> dict:
    """
    Current size, budget use and the largest tables.

    Physical size, not live data: after a DELETE the space is reusable by new
    rows but the files do not shrink, so this number falls only slowly. What it
    tells you is how close the database is to the point where a write must grow
    a file — which is exactly the point at which a capped database refuses it.
    """
    with connection.cursor() as cur:
        cur.execute("SELECT pg_database_size(current_database())")
        size_bytes = cur.fetchone()[0]
        cur.execute(
            """
            SELECT c.relname,
                   pg_total_relation_size(c.oid) AS total,
                   COALESCE(s.n_live_tup, 0),
                   COALESCE(s.n_dead_tup, 0)
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
            WHERE c.relkind = 'r' AND n.nspname = 'public'
            ORDER BY total DESC
            LIMIT %s
            """,
            [top],
        )
        tables = [
            {"table": name, "mb": round(total / 1_048_576, 1), "live_rows": live, "dead_rows": dead}
            for name, total, live, dead in cur.fetchall()
        ]

    size_mb = round(size_bytes / 1_048_576, 1)
    budget = budget_mb()

    # Live data in the largest tables, measured rather than inferred. After a
    # retention pass the files stay large while most of them is reusable, so
    # on-disk size alone keeps reporting "92% full" for a database with room
    # to spare. Summed server-side: nothing but one number crosses the wire.
    live_mb = 0.0
    for t in tables:
        if t["mb"] >= 1:
            t["live_mb"] = live_table_mb(t["table"])
            live_mb += t["live_mb"]
    live_mb = round(live_mb + sum(t["mb"] for t in tables if t["mb"] < 1), 1)

    return {
        "size_mb": size_mb,
        "live_mb": live_mb,
        "reusable_mb": round(max(size_mb - live_mb, 0), 1),
        "budget_mb": budget or None,
        "used_fraction": round(size_mb / budget, 3) if budget else None,
        "live_fraction": round(live_mb / budget, 3) if budget else None,
        "tables": tables,
    }


def live_table_mb(table: str) -> float:
    """Bytes of live row data in a table (heap only, excluding indexes and free space)."""
    with connection.cursor() as cur:
        cur.execute(f'SELECT COALESCE(SUM(pg_column_size(t.*)), 0) FROM "{table}" t')  # noqa: S608 - catalog names only
        return round(cur.fetchone()[0] / 1_048_576, 1)


# Rewriting a table with VACUUM FULL writes its live rows and rebuilds its
# indexes into new files before dropping the old ones. Budget for the rows
# plus indexes, with margin, and never go below a fixed floor of headroom.
COMPACT_OVERHEAD = 1.8
COMPACT_SAFETY_MB = 24
COMPACT_MIN_GAIN_MB = 16


def compact_tables(tables: list[str]) -> list[dict]:
    """
    Physically shrink tables that are mostly free space — only when it is safe.

    Plain VACUUM (run by retention) makes deleted space reusable but leaves the
    files their full size, so a capped database recovers its ability to write
    yet keeps reporting itself nearly full. VACUUM FULL returns the space, but
    it rewrites the table into NEW files first — which, at a storage cap, is
    exactly the operation that fails. So each table is compacted only when its
    estimated rewrite fits inside current headroom, smallest first, so every
    success enlarges the headroom for the next.

    Requires DATABASE_BUDGET_MB; without a known ceiling there is no way to
    prove a rewrite fits, and it is skipped. Never raises.
    """
    budget = budget_mb()
    if not budget:
        return []

    results = []
    candidates = []
    try:
        with connection.cursor() as cur:
            for table in tables:
                cur.execute("SELECT pg_total_relation_size(%s::regclass)", [table])
                total_mb = cur.fetchone()[0] / 1_048_576
                candidates.append((table, total_mb, live_table_mb(table)))
    except Exception as e:  # noqa: BLE001
        logger.warning("Compaction sizing failed: %s", str(e)[:160])
        return []

    for table, total_mb, live_mb in sorted(candidates, key=lambda c: c[2]):
        needed = live_mb * COMPACT_OVERHEAD
        gain = total_mb - needed
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT pg_database_size(current_database())")
                headroom = budget - cur.fetchone()[0] / 1_048_576 - COMPACT_SAFETY_MB
        except Exception:  # noqa: BLE001
            break
        entry = {"table": table, "total_mb": round(total_mb, 1), "live_mb": live_mb,
                 "needed_mb": round(needed, 1), "headroom_mb": round(headroom, 1)}
        if gain < COMPACT_MIN_GAIN_MB:
            entry["action"] = "skipped: little to reclaim"
        elif needed > headroom:
            entry["action"] = "skipped: rewrite would not fit"
        else:
            try:
                with connection.cursor() as cur:
                    cur.execute(f'VACUUM (FULL, ANALYZE) "{table}"')  # noqa: S608 - fixed identifiers only
                entry["action"] = "compacted"
            except Exception as e:  # noqa: BLE001 - a failed rewrite leaves the table as it was
                entry["action"] = f"failed: {str(e)[:120]}"
        results.append(entry)
        logger.info("Compaction: %s", entry)
    return results


def vacuum(tables: list[str]) -> list[str]:
    """
    Plain VACUUM, so space freed by DELETEs is reusable by the next writes.

    Not VACUUM FULL: that rewrites the table into new files, which needs as
    much free space as the table's live data — impossible at the cap, the one
    moment this matters. Plain VACUUM marks dead space reusable in place, which
    is enough for inserts to stop needing to extend files.

    Returns the tables that could not be vacuumed; never raises.
    """
    failed = []
    for table in tables:
        try:
            with connection.cursor() as cur:
                cur.execute(f'VACUUM (ANALYZE) "{table}"')  # noqa: S608 - fixed identifiers only
        except Exception as e:  # noqa: BLE001 - best effort by design
            logger.warning("VACUUM %s failed: %s", table, str(e)[:160])
            failed.append(table)
    return failed


def reactivate_sources_disabled_by_our_database() -> list[str]:
    """
    Undo circuit-breaker trips that were our database's fault, not the feed's.

    The breaker deactivates a source after repeated failures. During the
    capacity incident every feed "failed" with our own storage error, so
    healthy publishers were switched off. They are identifiable by the recorded
    reason, and are restored with their failure count reset. Genuine feed
    failures (HTTP errors, unparseable XML) do not match and stay off.
    """
    from core.models import Source

    restored = []
    for source in Source.objects.filter(is_active=False).only(
        "id", "name", "deactivated_reason", "last_error"
    ):
        reason = f"{source.deactivated_reason or ''} {source.last_error or ''}".lower()
        if any(sig in reason for sig in CAPACITY_SIGNATURES) or "operationalerror" in reason:
            source.is_active = True
            source.consecutive_failures = 0
            source.deactivated_reason = ""
            source.last_error = ""
            source.save(update_fields=["is_active", "consecutive_failures", "deactivated_reason", "last_error"])
            restored.append(source.name)
    if restored:
        logger.warning("Reactivated %d sources disabled by database errors: %s", len(restored), ", ".join(restored))
    return restored
