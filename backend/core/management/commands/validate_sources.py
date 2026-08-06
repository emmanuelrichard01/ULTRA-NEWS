"""
Check every feed in the source registry and report which ones actually work.

The registry shipped four permanently-dead feeds — including both Tier-1 wire
services, the ones the whole clustering strategy is built around — and nothing
surfaced it, because a fetch failure was indistinguishable from a quiet feed.
This makes that checkable in one command, so a broken URL is caught before it
reaches a deployment rather than months later.

    python manage.py validate_sources              # check the registry
    python manage.py validate_sources --db         # check active DB sources
    python manage.py validate_sources --fail-fast  # exit 1 if any feed is down
"""
from concurrent.futures import ThreadPoolExecutor

from django.core.management.base import BaseCommand

from core.models import Source
from core.services.scraper import FeedFetchError, FeedNotModified, RSSScraper
from core.source_registry import SOURCES


class Command(BaseCommand):
    help = "Validate that every configured RSS feed is reachable and parseable."

    def add_arguments(self, parser):
        parser.add_argument("--db", action="store_true", help="Validate active DB sources instead of the registry.")
        parser.add_argument("--workers", type=int, default=10)
        parser.add_argument(
            "--fail-fast", action="store_true",
            help="Exit non-zero if any feed fails, for CI use.",
        )

    def handle(self, *args, **opts):
        if opts["db"]:
            targets = [
                (s.name, s.url) for s in Source.objects.filter(is_active=True).order_by("name")
            ]
            label = "active database sources"
        else:
            targets = [(s["name"], s["url"]) for s in SOURCES]
            label = "registry entries"

        self.stdout.write(f"Validating {len(targets)} {label}…\n")

        scraper = RSSScraper()

        def check(target):
            name, url = target
            try:
                result = scraper._parse_feed(url)
                return name, url, len(result[0]), None
            except FeedNotModified:
                return name, url, 0, None
            except FeedFetchError as e:
                return name, url, 0, str(e)
            except Exception as e:  # noqa: BLE001 - report anything at all
                return name, url, 0, f"{type(e).__name__}: {str(e)[:100]}"

        with ThreadPoolExecutor(max_workers=opts["workers"]) as pool:
            results = list(pool.map(check, targets))

        healthy = [r for r in results if r[3] is None]
        broken = [r for r in results if r[3] is not None]

        for name, _url, entries, _err in sorted(healthy, key=lambda r: -r[2]):
            self.stdout.write(self.style.SUCCESS(f"  OK    {entries:4d} entries  {name}"))

        if broken:
            self.stdout.write("")
            for name, url, _entries, err in broken:
                self.stdout.write(self.style.ERROR(f"  FAIL  {name}"))
                self.stdout.write(f"          {url}")
                self.stdout.write(f"          {err}")

        rate = len(healthy) / len(results) * 100 if results else 0
        self.stdout.write("")
        summary = f"{len(healthy)}/{len(results)} feeds healthy ({rate:.0f}%)"
        self.stdout.write(
            self.style.SUCCESS(summary) if not broken else self.style.WARNING(summary)
        )

        if broken and opts["fail_fast"]:
            raise SystemExit(1)
