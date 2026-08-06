"""
Seed categories and sources without going through the API.

The `/admin/seed-db` endpoint still exists and does the same thing, but it
requires a deployed, reachable, authenticated API — which a CI runner holding
the database connection has no reason to need.
"""
from django.core.management.base import BaseCommand

from core.seeding import seed_database


class Command(BaseCommand):
    help = "Populate categories and the source registry. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument(
            '--quiet', action='store_true',
            help='Print only the summary, not every source.',
        )

    def handle(self, *args, **options):
        result = seed_database()

        if not options['quiet']:
            for line in result['sources']:
                self.stdout.write(f"  {line}")

        created = sum(1 for s in result['sources'] if s.endswith('Created'))
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(result['categories'])} categories and "
            f"{len(result['sources'])} sources "
            f"({created} new, {result['deactivated_count']} deactivated)"
        ))
