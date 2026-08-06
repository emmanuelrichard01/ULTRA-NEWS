"""
Ingestion tests.

These previously drove `scrape_all_sources()` and asserted on a "Scraped N
articles" return value. That task was refactored into a fire-and-forget Celery
dispatcher, so the assertions had been failing against a long-gone API — CI only
ran ruff, so nothing surfaced it. They now exercise `scrape_single_source`, which
is the unit that actually persists articles.
"""
import time
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from core.models import Article, RawDocument, Source
from core.tasks import scrape_single_source

FEED_XML = b"<rss><channel><title>Test</title></channel></rss>"


def _feed_response():
    """
    A 200 response carrying feed bytes.

    status_code and headers must be real values: the scraper now inspects them
    to tell 304 Not Modified and 4xx failures apart from a successful fetch, and
    a bare MagicMock compares as neither.
    """
    response = MagicMock()
    response.status_code = 200
    response.content = FEED_XML
    response.headers = {}
    response.raise_for_status = MagicMock()
    return response



@pytest.fixture
def seeded_categories(db):
    """Categorization matches against existing Category rows, so seed them."""
    from core.categorization import seed_all_categories
    list(seed_all_categories())


@pytest.fixture
def test_source(db):
    return Source.objects.create(
        name="Test News",
        url="http://example.com/rss",
        scraper_type="rss",
        is_active=True,
        trust_tier=Source.TrustTier.AUTO_PUBLISH,
    )


def _entry(link, title, summary):
    """Build a feedparser-shaped entry supporting both attribute and .get access."""
    data = {
        'link': link,
        'title': title,
        'summary': summary,
        'published_parsed': time.gmtime(),
        'media_content': None,
        'media_thumbnail': None,
        'links': [],
    }
    entry = MagicMock()
    entry.get.side_effect = lambda key, default=None: data.get(key, default)
    entry.published_parsed = data['published_parsed']
    entry.updated_parsed = None
    return entry


@pytest.fixture
def mock_feed():
    feed = MagicMock()
    feed.bozo = False
    feed.entries = [
        _entry(
            "http://example.com/article/1",
            "A Breaking Tech Story",
            "A major software company shipped a new artificial intelligence "
            "computer algorithm for developers.",
        ),
        _entry(
            "http://example.com/article/2",
            "Another Science Update",
            "Researchers published a study on climate research findings.",
        ),
    ]
    return feed


@pytest.fixture
def mock_network(mock_feed):
    """
    Stub the two network boundaries the scraper now has: the feed request and the
    per-article deep fetch. Deep fetch returns empty so RawDocument creation is
    driven purely by deep_fetch_success.
    """
    from core.services import scraper as scraper_module

    feed_response = _feed_response()

    with patch('httpx.get', return_value=feed_response), \
         patch('feedparser.parse', return_value=mock_feed), \
         patch.object(
             scraper_module.RSSScraper, '_enrich',
             lambda self, client, entry: None,
         ):
        yield


@pytest.mark.django_db
def test_rss_ingestion_creates_articles(test_source, seeded_categories, mock_network):
    """
    Ingestion persists one Article per feed entry, with a usable excerpt.

    It does NOT assign topics. Classification is semantic and needs the
    embedding, which clustering computes — see core.clustering._assign_topics.
    Keyword tagging used to run here over the full article body and was then
    overwritten by the semantic pass minutes later.
    """
    count = scrape_single_source(test_source.id)

    assert count == 2
    assert Article.objects.count() == 2

    article = Article.objects.get(url="http://example.com/article/1")
    assert article.excerpt  # excerpt is what the UI renders
    assert article.slug
    assert article.story is None  # clustered later


@pytest.mark.django_db
def test_rss_ingestion_deduplication(test_source, mock_network):
    """A second run over unchanged feed content creates nothing new."""
    assert scrape_single_source(test_source.id) == 2
    assert Article.objects.count() == 2

    assert scrape_single_source(test_source.id) == 0
    assert Article.objects.count() == 2


@pytest.mark.django_db
def test_known_urls_are_not_deep_fetched(test_source, mock_feed):
    """
    Articles already stored must be filtered out *before* the deep fetch.

    This is the regression guard for the ingestion bug where every entry was
    deep-fetched on every run — re-downloading the whole feed every 30 minutes
    regardless of what was new.
    """
    from core.services import scraper as scraper_module

    feed_response = _feed_response()

    enriched: list[str] = []

    def record_enrich(self, client, entry):
        enriched.append(entry['url'])

    with patch('httpx.get', return_value=feed_response), \
         patch('feedparser.parse', return_value=mock_feed), \
         patch.object(scraper_module.RSSScraper, '_enrich', record_enrich):

        scrape_single_source(test_source.id)
        assert sorted(enriched) == [
            "http://example.com/article/1",
            "http://example.com/article/2",
        ]

        enriched.clear()
        scrape_single_source(test_source.id)
        # Both URLs are stored now, so nothing should be fetched again.
        assert enriched == []


@pytest.mark.django_db
def test_raw_document_only_stored_on_successful_deep_fetch(test_source, mock_feed):
    """RawDocument holds extracted full text — it must not be written from a summary."""
    from core.services import scraper as scraper_module

    feed_response = _feed_response()

    def succeed_enrich(self, client, entry):
        entry['content'] = "<p>Full extracted body text.</p>"
        entry['deep_fetch_success'] = True

    with patch('httpx.get', return_value=feed_response), \
         patch('feedparser.parse', return_value=mock_feed), \
         patch.object(scraper_module.RSSScraper, '_enrich', succeed_enrich):
        scrape_single_source(test_source.id)

    assert RawDocument.objects.count() == 2


@pytest.mark.django_db
def test_source_health_tracked_on_success(test_source, mock_network):
    """A successful scrape stamps both timestamps and clears the failure state."""
    test_source.consecutive_failures = 3
    test_source.last_error = "HTTP 500"
    test_source.save(update_fields=['consecutive_failures', 'last_error'])

    before = timezone.now()
    scrape_single_source(test_source.id)

    test_source.refresh_from_db()
    assert test_source.consecutive_failures == 0
    assert test_source.last_error == ""
    assert test_source.last_fetched_at >= before
    assert test_source.last_success_at >= before


# ==========================================================================
# Failure detection — the defect that made dead feeds look healthy
# ==========================================================================

def _error_response(status: int):
    response = MagicMock()
    response.status_code = status
    response.content = b""
    response.headers = {}
    return response


@pytest.mark.django_db
@pytest.mark.parametrize("status", [403, 404, 500])
def test_http_error_is_recorded_as_a_failure(test_source, status):
    """
    A failing fetch must increment consecutive_failures.

    Previously an HTTP error was swallowed into an empty article list, the task
    saw no exception, and stamped consecutive_failures = 0 — so four
    permanently-dead feeds (including both Tier-1 wire services) reported as
    healthy on the source dashboard for the life of the registry.
    """
    with patch('httpx.get', return_value=_error_response(status)):
        assert scrape_single_source(test_source.id) == 0

    test_source.refresh_from_db()
    assert test_source.consecutive_failures == 1
    assert str(status) in test_source.last_error
    assert test_source.last_success_at is None


@pytest.mark.django_db
def test_unparseable_feed_is_recorded_as_a_failure(test_source):
    """A 200 carrying an HTML error page is a failure, not an empty feed."""
    html = MagicMock()
    html.status_code = 200
    html.content = b"<html><body>Access denied</body></html>"
    html.headers = {}

    with patch('httpx.get', return_value=html):
        assert scrape_single_source(test_source.id) == 0

    test_source.refresh_from_db()
    assert test_source.consecutive_failures == 1
    assert test_source.last_success_at is None


@pytest.mark.django_db
def test_circuit_breaker_deactivates_persistently_failing_source(test_source):
    """After FAILURE_THRESHOLD consecutive failures the source is disabled."""
    test_source.consecutive_failures = Source.FAILURE_THRESHOLD - 1
    test_source.save(update_fields=['consecutive_failures'])

    with patch('httpx.get', return_value=_error_response(404)):
        scrape_single_source(test_source.id)

    test_source.refresh_from_db()
    assert test_source.is_active is False
    assert "Auto-disabled" in test_source.deactivated_reason


@pytest.mark.django_db
def test_not_modified_counts_as_success(test_source):
    """
    304 means the publisher confirmed nothing changed — a success, and the
    cheapest kind, since no body is transferred at all.
    """
    test_source.etag = 'W/"abc123"'
    test_source.consecutive_failures = 2
    test_source.save(update_fields=['etag', 'consecutive_failures'])

    with patch('httpx.get', return_value=_error_response(304)) as mock_get:
        assert scrape_single_source(test_source.id) == 0
        sent_headers = mock_get.call_args.kwargs['headers']
        assert sent_headers['If-None-Match'] == 'W/"abc123"'

    test_source.refresh_from_db()
    assert test_source.consecutive_failures == 0
    assert test_source.last_success_at is not None


@pytest.mark.django_db
def test_cache_validators_are_stored_for_the_next_request(test_source, mock_feed):
    """ETag/Last-Modified are captured so the next fetch can be conditional."""
    from core.services import scraper as scraper_module

    response = _feed_response()
    response.headers = {'ETag': 'W/"xyz"', 'Last-Modified': 'Wed, 21 Oct 2026 07:28:00 GMT'}

    with patch('httpx.get', return_value=response), \
         patch('feedparser.parse', return_value=mock_feed), \
         patch.object(scraper_module.RSSScraper, '_enrich', lambda self, c, e: None):
        scrape_single_source(test_source.id)

    test_source.refresh_from_db()
    assert test_source.etag == 'W/"xyz"'
    assert test_source.last_modified == 'Wed, 21 Oct 2026 07:28:00 GMT'
