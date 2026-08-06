"""
Inspect and apply the data retention policy.

    python manage.py retention              # show archive stats + dry run
    python manage.py retention --apply      # actually release the data
"""
from django.core.management.base import BaseCommand

from core.retention import archive_stats, run_retention


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
        result = run_retention(dry_run=not opts["apply"])

        if not result.get("enabled"):
            self.stdout.write(self.style.WARNING("Retention is disabled (RETENTION_ENABLED=0)."))
            return

        self.stdout.write(self.style.MIGRATE_HEADING(
            "Applied" if opts["apply"] else "Would release (dry run)"
        ))
        for key in (
            "raw_documents_purged",
            "article_payloads_cleared",
            "uncorroborated_stories_deleted",
        ):
            self.stdout.write(f"  {key:32} {result[key]}")

        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("\nDry run — pass --apply to release."))
