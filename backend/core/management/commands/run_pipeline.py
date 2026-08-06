"""
Run the whole ingestion pipeline synchronously, in one process.

Exists for deployments with no Celery worker — the $0 path runs this on a
GitHub Actions cron, where the runner has 7 GB and four cores for free while the
API host has 512 MB and a fraction of a core. Batch work belongs on the runner.

`ingest_news` cannot serve this case: it calls `.delay()`, so without a worker it
enqueues into nothing and reports success.

Two things make this one command rather than three:

  - **One model load.** The embedding model takes ~11 s to load. Three separate
    `manage.py` invocations pay that three times; one pays it once.
  - **Ordering is not optional.** Clustering must see the articles ingestion just
    wrote, and momentum must see the clusters. Separate scheduled jobs would race.
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    help = "Ingest, cluster and refresh momentum in a single synchronous run."

    def add_arguments(self, parser):
        parser.add_argument(
            '--workers', type=int, default=8,
            help='Concurrent feed fetches. Kept modest to stay polite to '
                 'publishers and inside the database connection limit.',
        )
        parser.add_argument(
            '--skip-ingest', action='store_true',
            help='Cluster and refresh what is already stored, fetching nothing.',
        )

    def handle(self, *args, **options):
        from core.models import Source

        started = time.monotonic()
        ingested = 0
        failed_sources = []
        source_ids = []

        if not options['skip_ingest']:
            source_ids = list(
                Source.objects.filter(is_active=True).values_list('id', flat=True)
            )
            self.stdout.write(f"Ingesting {len(source_ids)} active sources…")
            ingested, failed_sources = self._ingest(source_ids, options['workers'])
            self.stdout.write(
                f"  {ingested} new articles, {len(failed_sources)} sources failed"
            )

        self.stdout.write("Clustering…")
        from core.tasks import cluster_pending_articles
        # Returns a human-readable summary string, not a count.
        clustered = cluster_pending_articles()

        self.stdout.write("Refreshing momentum…")
        from core.momentum import refresh_momentum
        momentum = refresh_momentum()

        elapsed = time.monotonic() - started
        self.stdout.write(self.style.SUCCESS(
            f"Pipeline complete in {elapsed:.1f}s — "
            f"ingested {ingested} articles, {clustered.lower()}, "
            f"momentum updated on {momentum['updated']} stories "
            f"({momentum['zeroed']} decayed to zero)"
        ))

        # Exit non-zero when *every* source failed. Without a metrics scraper on
        # the $0 path, a red workflow run is the alerting channel — but a single
        # publisher having a bad afternoon must not page anyone, so only total
        # failure counts.
        if failed_sources and len(failed_sources) == len(source_ids):
            self.stderr.write(self.style.ERROR(
                f"Every source failed ({len(failed_sources)}). "
                "Check network egress and the source registry."
            ))
            raise SystemExit(1)

    def _ingest(self, source_ids, workers):
        from core.tasks import scrape_single_source

        def scrape(source_id):
            try:
                return source_id, scrape_single_source(source_id), None
            except Exception as e:  # noqa: BLE001 - one bad feed must not stop the run
                return source_id, 0, e
            finally:
                # Database connections are thread-local. Without this each pool
                # thread leaks one for the life of the process, which a small
                # Postgres tier notices.
                connections.close_all()

        total, failures = 0, []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(scrape, sid) for sid in source_ids]
            for future in as_completed(futures):
                source_id, count, error = future.result()
                total += count
                if error is not None:
                    failures.append(source_id)
                    self.stderr.write(f"  source {source_id}: {str(error)[:120]}")

        return total, failures
