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
        parser.add_argument(
            '--cluster-seconds', type=int, default=900, metavar='S',
            help='Time budget for clustering. It stops cleanly at the deadline '
                 'and the next run resumes — far better than being killed by a '
                 'job timeout, which loses the run without keeping the progress.',
        )
        parser.add_argument(
            '--synthesize', type=int, default=10, metavar='N',
            help='Generate briefs for up to N stories, most-corroborated first. '
                 '0 disables. This is the real spend ceiling for a one-shot run '
                 '— see the note in the source.',
        )

    def handle(self, *args, **options):
        from django.conf import settings

        from core.models import Source

        # This command synthesises in-process, so queueing the same work for a
        # worker is pure waste — and on the deployment this command exists for,
        # there is no worker and no broker. Each `.delay()` then blocks on
        # connection retries (~39s on a CI runner) before failing, once per
        # promoted story. Left enabled, that alone exhausted the job timeout.
        settings.CELERY_DISPATCH_ENABLED = False

        # This command ends with a full momentum refresh, so refreshing per
        # matched story on the way there recomputes the same values repeatedly.
        settings.MOMENTUM_REFRESH_ON_CLUSTER = False

        started = time.monotonic()
        ingested = 0
        failed_sources = []
        source_ids = []

        if not options['skip_ingest']:
            # Self-seed an empty database. Without this a fresh deployment runs
            # green while doing nothing: ingestion iterates active sources, and
            # with none registered it succeeds having fetched zero feeds, which
            # is indistinguishable from working. Seeding is idempotent, so the
            # check costs one COUNT on every subsequent run.
            if not Source.objects.exists():
                from core.seeding import seed_database
                self.stdout.write("No sources registered — seeding the registry…")
                summary = seed_database()
                self.stdout.write(f"  seeded {len(summary['sources'])} sources")

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
        clustered = cluster_pending_articles(
            deadline_seconds=options['cluster_seconds']
        )

        self.stdout.write("Refreshing momentum…")
        from core.momentum import refresh_momentum
        momentum = refresh_momentum()

        synthesized = self._synthesize(options['synthesize'])

        elapsed = time.monotonic() - started
        self.stdout.write(self.style.SUCCESS(
            f"Pipeline complete in {elapsed:.1f}s — "
            f"ingested {ingested} articles, {clustered.lower()}, "
            f"momentum updated on {momentum['updated']} stories "
            f"({momentum['zeroed']} decayed to zero), "
            f"{synthesized} briefs written"
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

    def _synthesize(self, limit):
        """
        Write story briefs in-process.

        Without this, briefs never appear on a deployment with no Celery worker.
        Clustering dispatches synthesis with `.delay()`, and that dispatch is
        wrapped in a try/except that logs and moves on — so with no broker it
        fails silently on every story, forever. The pipeline looks healthy and
        the feature is simply absent.

        **The limit is the spend ceiling here, not the daily budget.** The task's
        `MAX_SYNTHESIS_DAILY_REQUESTS` counter lives in the cache, and a one-shot
        process using locmem starts with an empty cache every run — so that
        ceiling counts to zero each time and never trips. In this context the
        only thing actually bounding inference spend is this argument.
        """
        if limit <= 0:
            return 0

        from core.clustering import _should_resynthesize
        from core.models import Story
        from core.services.llm import is_configured
        from core.tasks import synthesize_story_brief

        if not is_configured():
            # Keyless still produces extractive briefs, which are worth having —
            # but say so, because "0 briefs written" otherwise looks like a fault.
            self.stdout.write("Synthesising (keyless — briefs will be extractive)…")
        else:
            self.stdout.write(f"Synthesising up to {limit} briefs…")

        # Most-corroborated first: if the budget runs out, it should run out on
        # the stories fewest people are reading.
        candidates = (
            Story.objects
            .filter(status__in=[Story.Status.DEVELOPING, Story.Status.CORROBORATED])
            .order_by('-independent_count', '-last_updated_at')[:limit * 4]
        )

        written = 0
        for story in candidates:
            if written >= limit:
                break
            if not _should_resynthesize(story):
                continue
            try:
                synthesize_story_brief(story.id)
                written += 1
            except Exception as e:  # noqa: BLE001 - one bad story must not end the run
                self.stderr.write(f"  story {story.slug}: {str(e)[:120]}")

        return written

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
