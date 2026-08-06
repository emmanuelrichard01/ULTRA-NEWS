"""
Populate categories and the source registry.

This logic lived inside the `/admin/seed-db` HTTP handler, which meant a
database could only be seeded by an already-running API. That is backwards for
a deployment whose whole pipeline runs on a CI runner: the runner has the
database, the code and the registry, and no reason to make an authenticated
round trip to a web server to write rows it could write directly.

Extracted here so three callers share one implementation:

  - `POST /admin/seed-db`  — unchanged, for an operator with a key
  - `manage.py seed_registry` — for CI and for local setup
  - `run_pipeline` — self-seeds an empty database, so a fresh deploy needs
    no manual step at all
"""
import logging

logger = logging.getLogger(__name__)


def seed_database() -> dict:
    """
    Idempotent. Safe to run on every deploy.

    Returns a summary dict; the API handler serialises it directly.
    """
    from core.categorization import seed_all_categories
    from core.models import Source, derive_publisher_domain
    from core.source_registry import SOURCES

    categories = [
        f"{name}: {'Created' if created else 'Exists'}"
        for name, created in seed_all_categories()
    ]

    sources = []
    registry_urls = {s["url"] for s in SOURCES}

    for s in SOURCES:
        # An explicit publisher_domain wins over deriving one from the feed
        # host — needed when a feed is served by a syndication host that isn't
        # the newsroom that wrote the articles.
        publisher = s.get("publisher_domain") or derive_publisher_domain(s["url"])

        obj, created = Source.objects.get_or_create(
            url=s["url"],
            defaults={
                "name": s["name"],
                "scraper_type": s["scraper_type"],
                "source_type": s.get("source_type", "news"),
                "publisher_domain": publisher,
                "trust_tier": Source.TrustTier.AUTO_PUBLISH,
                "is_active": True,
            },
        )

        if not created:
            # `trust_tier` and `publisher_domain` were once assigned but omitted
            # from update_fields, so those writes were silently discarded and
            # re-seeding never actually promoted a source out of the review
            # queue. Diff every field that the registry owns.
            desired = {
                "source_type": s.get("source_type", "news"),
                "trust_tier": Source.TrustTier.AUTO_PUBLISH,
                "name": s["name"],
                "is_active": True,
                "publisher_domain": publisher,
            }
            changed = [f for f, v in desired.items() if getattr(obj, f) != v]
            if changed:
                for field in changed:
                    setattr(obj, field, desired[field])
                obj.save(update_fields=changed)

        sources.append(f"{s['name']}: {'Created' if created else 'Exists'}")

    # A source dropped from the registry is deactivated rather than deleted, so
    # the articles it already contributed keep their attribution.
    stale = Source.objects.filter(is_active=True).exclude(url__in=registry_urls)
    stale_names = list(stale.values_list("name", flat=True))
    stale_count = stale.update(is_active=False)

    return {
        "status": "completed",
        "categories": categories,
        "sources": sources,
        "deactivated": stale_names,
        "deactivated_count": stale_count,
    }
