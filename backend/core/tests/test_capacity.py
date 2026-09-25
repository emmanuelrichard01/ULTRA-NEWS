"""
Database capacity — the September 2026 Neon incident, pinned.

Production hit Neon's 512 MB storage cap. Three behaviours turned a quota into
a two-week outage, and each has a test here:

  - retention could not run at the cap, and one failing step skipped the rest
  - our own database errors were charged to publishers, and the circuit
    breaker switched healthy feeds off
  - de-duplication pulled every stored URL per source per run, a large share of
    the metered transfer that ran out in August

See docs/incidents/2026-09-neon-capacity.md.
"""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import OperationalError
from django.utils import timezone

from core import retention
from core.models import Article, Source, Story
from core.storage import (
    is_database_capacity_error,
    is_database_error,
    reactivate_sources_disabled_by_our_database,
)

NEON_FULL = OperationalError(
    "could not extend file because project size limit (512 MB) has been exceeded"
)


# ==========================================================================
# Recognising the failure
# ==========================================================================

@pytest.mark.parametrize("message", [
    "could not extend file because project size limit (512 MB) has been exceeded",
    "ERROR:  Your project has exceeded the data transfer quota. Upgrade your plan",
    "could not write to file: No space left on device",
])
def test_capacity_errors_are_recognised(message):
    assert is_database_capacity_error(OperationalError(message))


def test_an_ordinary_error_is_not_a_capacity_error():
    assert not is_database_capacity_error(ValueError("bad feed XML"))


def test_database_errors_are_found_through_the_cause_chain():
    try:
        try:
            raise NEON_FULL
        except OperationalError as inner:
            raise RuntimeError("wrapped") from inner
    except RuntimeError as outer:
        assert is_database_error(outer)


# ==========================================================================
# Retention at the cap
# ==========================================================================

def test_retention_deletes_before_it_updates():
    """
    DELETEs do not need to grow a file; the payload UPDATE does. At the cap
    the UPDATE fails, so it must come after the space-freeing steps.
    """
    calls = []
    with patch.object(retention, "delete_uncorroborated_stories", lambda d: calls.append("delete_stories") or 0), \
         patch.object(retention, "purge_raw_documents", lambda d: calls.append("purge_raw") or 0), \
         patch.object(retention, "clear_stale_article_payloads", lambda d: calls.append("update_payloads") or 0), \
         patch("core.storage.vacuum", lambda tables: calls.append("vacuum") or []):
        retention.run_retention(dry_run=False)

    assert calls == ["delete_stories", "purge_raw", "vacuum", "update_payloads"]


def test_one_failing_step_does_not_skip_the_others():
    """
    The production failure: the UPDATE crashed at the cap and the DELETE after
    it — the largest saving — never ran. Now every step runs, then it fails.
    """
    ran = []

    def failing_update(dry_run):
        raise NEON_FULL

    with patch.object(retention, "delete_uncorroborated_stories", lambda d: ran.append("delete") or 7), \
         patch.object(retention, "purge_raw_documents", lambda d: ran.append("purge") or 3), \
         patch.object(retention, "clear_stale_article_payloads", failing_update), \
         patch("core.storage.vacuum", lambda tables: []), \
         pytest.raises(retention.RetentionIncomplete) as exc:
        retention.run_retention(dry_run=False)

    assert ran == ["delete", "purge"]
    result = exc.value.result
    assert result["uncorroborated_stories_deleted"] == 7
    assert result["raw_documents_purged"] == 3
    assert result["article_payloads_cleared"] is None
    assert "project size limit" in result["errors"][0]


@pytest.mark.django_db
def test_payloads_are_cleared_in_batches(settings, monkeypatch):
    """One UPDATE over the whole archive needs all its space at once."""
    settings.RETENTION_ARTICLE_PAYLOAD_DAYS = 1
    monkeypatch.setattr(retention, "PAYLOAD_BATCH", 2)
    source = Source.objects.create(name="S", url="https://s.example/rss", scraper_type="rss")
    old = timezone.now() - timedelta(days=10)
    for i in range(5):
        Article.objects.create(
            source=source, title=f"t{i}", url=f"https://s.example/{i}",
            content="body", published_date=old, embedding=[0.1] * 384,
        )

    assert retention.clear_stale_article_payloads() == 5
    assert Article.objects.filter(embedding__isnull=False).count() == 0
    assert not Article.objects.exclude(content="").exists()


@pytest.mark.django_db
def test_dry_run_changes_nothing(settings):
    settings.RETENTION_UNCORROBORATED_STORY_DAYS = 1
    Story.objects.create(
        title="old", slug="old", first_seen_at=timezone.now() - timedelta(days=30),
        independent_count=1, source_count=1,
    )
    result = retention.run_retention(dry_run=True)
    assert result["uncorroborated_stories_deleted"] == 1
    assert Story.objects.filter(slug="old").exists()


# ==========================================================================
# Publishers are not blamed for our outage
# ==========================================================================

@pytest.fixture
def source(db):
    return Source.objects.create(
        name="Healthy Feed", url="https://feed.example/rss", scraper_type="rss",
        is_active=True, trust_tier=Source.TrustTier.AUTO_PUBLISH,
    )


@pytest.mark.django_db
def test_a_database_error_is_not_recorded_against_the_feed(source):
    from core.tasks import scrape_single_source

    with patch("core.services.scraper.ScraperService.scrape_source", side_effect=NEON_FULL), \
         pytest.raises(OperationalError):
        scrape_single_source(source.id)

    source.refresh_from_db()
    assert source.consecutive_failures == 0
    assert source.is_active


@pytest.mark.django_db
def test_a_genuine_feed_failure_still_counts(source):
    from core.tasks import scrape_single_source

    with patch("core.services.scraper.ScraperService.scrape_source", side_effect=ValueError("bad XML")):
        assert scrape_single_source(source.id) == 0

    source.refresh_from_db()
    assert source.consecutive_failures == 1


@pytest.mark.django_db
def test_feeds_disabled_by_our_database_are_reactivated_and_real_failures_are_not():
    wrongly_off = Source.objects.create(
        name="Politico", url="https://politico.example/rss", scraper_type="rss",
        is_active=False, consecutive_failures=12,
        deactivated_reason=(
            "Auto-disabled after 12 consecutive failures: OperationalError: could not "
            "extend file because project size limit (512 MB) has been exceeded"
        ),
    )
    really_dead = Source.objects.create(
        name="Dead Feed", url="https://dead.example/rss", scraper_type="rss",
        is_active=False, consecutive_failures=12,
        deactivated_reason="Auto-disabled after 12 consecutive failures: HTTP 404",
    )

    restored = reactivate_sources_disabled_by_our_database()

    assert restored == ["Politico"]
    wrongly_off.refresh_from_db()
    really_dead.refresh_from_db()
    assert wrongly_off.is_active and wrongly_off.consecutive_failures == 0
    assert not really_dead.is_active


# ==========================================================================
# De-duplication transfer
# ==========================================================================

def test_known_url_lookup_is_asked_only_about_this_feeds_urls():
    """
    It used to receive every URL the source had ever produced, loaded before
    the conditional GET. Now it is a lookup, called with the feed's own URLs.
    """
    from core.services.scraper import RSSScraper

    entries = [
        {"url": "https://a.example/1", "published_date": timezone.now(), "title": "1"},
        {"url": "https://a.example/2", "published_date": timezone.now(), "title": "2"},
    ]
    asked = []

    def lookup(urls):
        asked.append(sorted(urls))
        return set(urls)  # everything already stored

    scraper = RSSScraper()
    with patch.object(RSSScraper, "_parse_feed", return_value=(entries, "", "")):
        scraper.fetch_articles("https://a.example/rss", skip_urls=lookup)

    assert asked == [["https://a.example/1", "https://a.example/2"]]


def test_known_url_lookup_is_never_called_on_a_304():
    from core.services.scraper import FeedNotModified, RSSScraper

    called = []
    with patch.object(RSSScraper, "_parse_feed", side_effect=FeedNotModified()), \
         pytest.raises(FeedNotModified):
        RSSScraper().fetch_articles("https://a.example/rss", skip_urls=lambda urls: called.append(urls) or set())

    assert called == []
