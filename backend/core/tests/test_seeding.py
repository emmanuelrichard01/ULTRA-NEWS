"""
Registry seeding.

This code had no test while it lived inside the API handler, and the first time
it ran outside a request it failed on an import that had been satisfied by the
handler's own module namespace. Seeding is the first thing a new deployment
does, so a failure here is a failure nobody has a running system to debug with.
"""
import pytest

from core.models import Source
from core.seeding import seed_database


@pytest.mark.django_db
def test_seeding_populates_categories_and_sources():
    result = seed_database()

    assert result["status"] == "completed"
    assert result["categories"], "no categories seeded"
    assert Source.objects.count() == len(result["sources"])
    assert Source.objects.filter(is_active=True).exists()


@pytest.mark.django_db
def test_every_seeded_source_has_a_publisher_identity():
    """
    Corroboration counts distinct publishers, and a blank domain collapses every
    unresolved source into one. `independence_key` falls back to the feed URL,
    but the domain is what makes two feeds from one newsroom count once.
    """
    seed_database()

    for source in Source.objects.all():
        assert source.independence_key, f"{source.name} has no publisher identity"


@pytest.mark.django_db
def test_seeding_is_idempotent():
    """Runs on every deploy, and run_pipeline calls it on an empty database."""
    first = seed_database()
    count_after_first = Source.objects.count()

    second = seed_database()

    assert Source.objects.count() == count_after_first
    assert len(second["sources"]) == len(first["sources"])
    assert all(line.endswith("Exists") for line in second["sources"])


@pytest.mark.django_db
def test_reseeding_promotes_a_source_out_of_the_review_queue():
    """
    Regression guard. `trust_tier` and `publisher_domain` were assigned but left
    out of `update_fields`, so those writes were silently discarded — re-seeding
    could never repair a source stuck in the review queue.
    """
    seed_database()
    source = Source.objects.filter(is_active=True).first()
    Source.objects.filter(pk=source.pk).update(
        trust_tier=Source.TrustTier.REVIEW_QUEUE, is_active=False,
    )

    seed_database()

    source.refresh_from_db()
    assert source.trust_tier == Source.TrustTier.AUTO_PUBLISH
    assert source.is_active is True


@pytest.mark.django_db
def test_a_source_outside_the_registry_is_deactivated_not_deleted():
    """Its articles keep their attribution, so the row has to survive."""
    retired = Source.objects.create(
        name="Retired Wire", url="https://retired.example/rss", is_active=True,
    )

    result = seed_database()

    retired.refresh_from_db()
    assert retired.is_active is False
    assert "Retired Wire" in result["deactivated"]
