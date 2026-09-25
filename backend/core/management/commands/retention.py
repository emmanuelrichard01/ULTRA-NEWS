"""
Inspect and apply the data retention policy.

    python manage.py retention              # show archive stats + dry run
    python manage.py retention --apply      # actually release the data

With --apply it also restores feeds the circuit breaker disabled because OUR
database was failing (core.storage.reactivate_sources_disabled_by_our_database):
maintenance is the job that runs once the database can take writes again.
"""
from django.core.management.base import BaseCommand, CommandError

from core.retention import RetentionIncomplete, archive_stats, run_retention

STEPS = (
    "uncorroborated_stories_deleted",
    "raw_documents_purged",
    "article_payloads_cleared",
)


class Command(BaseCommand):
    help = "Report archive size and apply the retention policy."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Persist deletions.")

    def handle(self, *args, **opts):
        stats = archive_stats()
        self.stdout.write(self.style.MIGRATE_HEADING("Archive"))
        for key, value in stats.items():
            self.stdout.write(f"  {key:28} {value}")
        self.stdout.write("")

        failed = None
        try:
            result = run_retention(dry_run=not opts["apply"])
        except RetentionIncomplete as e:
            # Report what DID happen before failing — a partial pass on a full
            # database is still progress, and the log should show it.
            result, failed = e.result, e

        if not result.get("enabled"):
            self.stdout.write(self.style.WARNING("Retention is disabled (RETENTION_ENABLED=0)."))
            return

        self.stdout.write(self.style.MIGRATE_HEADING(
            "Applied" if opts["apply"] else "Would release (dry run)"
        ))
        for key in STEPS:
            value = result.get(key)
            self.stdout.write(f"  {key:32} {'FAILED' if value is None else value}")
        if result.get("vacuum_failed"):
            self.stdout.write(f"  vacuum failed on              {', '.join(result['vacuum_failed'])}")

        if opts["apply"]:
            from core.storage import reactivate_sources_disabled_by_our_database

            try:
                restored = reactivate_sources_disabled_by_our_database()
            except Exception as e:  # noqa: BLE001 - report, don't mask the retention result
                self.stderr.write(f"  could not reactivate sources: {str(e)[:160]}")
            else:
                if restored:
                    self.stdout.write(self.style.SUCCESS(
                        f"  reactivated {len(restored)} feeds disabled by database errors: "
                        + ", ".join(restored)
                    ))

        if failed:
            for err in result["errors"]:
                self.stderr.write(self.style.ERROR(f"  {err}"))
            raise CommandError(str(failed))

        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("\nDry run — pass --apply to release."))
