"""
Report database size against its budget.

    python manage.py db_report                 # print
    DATABASE_BUDGET_MB=512 python manage.py db_report --fail-at 0.95

Run by both CI workflows after their main step. In GitHub Actions it also
writes a table to the run's summary page and raises a `::warning::`
annotation past 80% of budget — so a database filling up is visible on every
run, days before the provider starts refusing writes. In September 2026 the
first sign was Neon's own "100% used" email, after which retention could no
longer run (docs/incidents/2026-09-neon-capacity.md).
"""
import os

from django.core.management.base import BaseCommand, CommandError

WARN_AT = 0.80


class Command(BaseCommand):
    help = "Show database size, budget use and the largest tables."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fail-at", type=float, default=None, metavar="FRACTION",
            help="Exit non-zero when size / budget reaches this fraction.",
        )

    def handle(self, *args, **opts):
        from core.storage import database_report

        report = database_report()
        used = report["used_fraction"]
        budget = report["budget_mb"]

        headline = (
            f"Database {report['size_mb']} MB of {budget} MB ({used:.0%})"
            if budget else f"Database {report['size_mb']} MB (no budget set)"
        )
        self.stdout.write(self.style.MIGRATE_HEADING(headline))
        for t in report["tables"]:
            self.stdout.write(
                f"  {t['table']:32} {t['mb']:>8} MB  {t['live_rows']:>9} live  {t['dead_rows']:>8} dead"
            )

        in_actions = os.environ.get("GITHUB_ACTIONS") == "true"
        if in_actions and used is not None and used >= WARN_AT:
            # Workflow command: surfaces as an annotation on the run page.
            self.stdout.write(
                f"::warning title=Database near its storage budget::{headline}. "
                "Retention windows may need tightening — see docs/incidents/2026-09-neon-capacity.md"
            )

        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            rows = "\n".join(
                f"| `{t['table']}` | {t['mb']} | {t['live_rows']:,} | {t['dead_rows']:,} |"
                for t in report["tables"]
            )
            bar = ""
            if used is not None:
                filled = min(20, round(used * 20))
                bar = f"`{'█' * filled}{'░' * (20 - filled)}` {used:.0%}\n\n"
            with open(summary_path, "a", encoding="utf-8") as fh:
                fh.write(
                    f"### {headline}\n\n{bar}"
                    "| Table | MB | Live rows | Dead rows |\n| --- | ---: | ---: | ---: |\n"
                    f"{rows}\n\n"
                )

        if opts["fail_at"] is not None and used is not None and used >= opts["fail_at"]:
            raise CommandError(f"{headline} — at or above the {opts['fail_at']:.0%} limit")
