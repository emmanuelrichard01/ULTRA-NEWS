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
    return {
        "size_mb": size_mb,
        "budget_mb": budget or None,
        "used_fraction": round(size_mb / budget, 3) if budget else None,
        "tables": tables,
    }


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
