"""
Regression guards for defects that were silently shipping.

Each test here corresponds to a feature that was fully non-functional in
production while every test passed and nothing logged an error. They are grouped
by the bug they lock down.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from core.models import Article, Source, Story, derive_publisher_domain


@pytest.fixture
def source(db):
    return Source.objects.create(
        name="Wire A",
        url="https://feeds.example-a.com/rss",
        trust_tier=Source.TrustTier.AUTO_PUBLISH,
    )


# ==========================================================================
# Article.embedding was computed then thrown away
# ==========================================================================

@pytest.mark.django_db
def test_cluster_article_persists_article_embedding(source):
    """
    cluster_article() computed an embedding and then saved with
    update_fields=['story'], so it never reached the database. Every
    Article.embedding stayed NULL, which silently reduced the /ask vector search
    to matching nothing at all.
    """
    from core.clustering import cluster_article, get_embedding_model

    if not get_embedding_model():
        pytest.skip("fastembed unavailable")

    article = Article.objects.create(
        source=source,
        title="Central Bank Holds Rates Steady",
        url="https://example-a.com/1",
        excerpt="Policymakers left the benchmark rate unchanged.",
        published_date=timezone.now(),
    )

    cluster_article(article)

    article.refresh_from_db()
    assert article.embedding is not None, "embedding was not persisted"
    assert len(article.embedding) == 384


# ==========================================================================
# search_vector was never populated
# ==========================================================================

@pytest.mark.django_db
def test_search_vector_populated_by_trigger(source):
    """
    search_vector had a GIN index but no code path ever wrote to it, so
    full-text search matched zero rows for every query. It is now maintained by
    a database trigger (migration 0013).
    """
    from django.contrib.postgres.search import SearchQuery

    Article.objects.create(
        source=source,
        title="Parliament Debates Renewable Energy Subsidies",
        url="https://example-a.com/energy",
        excerpt="Lawmakers considered new photovoltaic incentives.",
        published_date=timezone.now(),
    )

    matches = Article.objects.filter(
        search_vector=SearchQuery("renewable", config="english")
    )
    assert matches.count() == 1

    # Body text is indexed too, at lower weight.
    assert Article.objects.filter(
        search_vector=SearchQuery("photovoltaic", config="english")
    ).exists()


@pytest.mark.django_db
def test_search_vector_updates_on_title_change(source):
    """The trigger must fire on UPDATE, not only INSERT."""
    from django.contrib.postgres.search import SearchQuery

    article = Article.objects.create(
        source=source,
        title="Initial Headline About Shipping",
        url="https://example-a.com/shipping",
        published_date=timezone.now(),
    )

    article.title = "Revised Headline About Aviation"
    article.save(update_fields=["title"])

    assert Article.objects.filter(
        search_vector=SearchQuery("aviation", config="english")
    ).exists()
    assert not Article.objects.filter(
        search_vector=SearchQuery("shipping", config="english")
    ).exists()


# ==========================================================================
# independent_count counted feed URLs, not publishers
# ==========================================================================

@pytest.mark.parametrize("url,expected", [
    ("https://feeds.bbci.co.uk/news/world/rss.xml", "bbci.co.uk"),
    ("https://www.bbci.co.uk/news/tech/rss.xml", "bbci.co.uk"),
    ("https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "nytimes.com"),
    ("https://www.theguardian.com/world/rss", "theguardian.com"),
    ("https://example.com.au/feed", "example.com.au"),
    # Compound ccTLDs must survive. A dot-counting implementation reduced this
    # to "co.ke", which would have collapsed every Kenyan outlet into one
    # publisher and silently destroyed corroboration counting for that region.
    ("https://www.theeastafrican.co.ke/rss", "theeastafrican.co.ke"),
    ("https://www.japantimes.co.jp/feed", "japantimes.co.jp"),
    ("https://news.com.br/rss", "news.com.br"),
    ("not a url", ""),
    ("", ""),
])
def test_derive_publisher_domain(url, expected):
    assert derive_publisher_domain(url) == expected


@pytest.mark.django_db
def test_registry_sources_all_resolve_to_a_publisher():
    """
    Every URL in the shipped source registry must yield a registrable domain.
    An empty result falls back to the raw feed URL, which quietly defeats the
    de-duplication this field exists to provide.
    """
    from core.source_registry import SOURCES

    unresolved = [s["url"] for s in SOURCES if not derive_publisher_domain(s["url"])]
    assert unresolved == []


@pytest.mark.django_db
def test_two_feeds_from_one_publisher_count_as_one_source(db):
    """
    Corroboration is meaningless if one newsroom can corroborate itself. Two
    feeds from the same publisher previously counted as two independent sources
    and falsely promoted a story to Developing.
    """
    from core.clustering import _recount_cluster

    world = Source.objects.create(name="BBC World", url="https://feeds.bbci.co.uk/news/world/rss.xml")
    tech = Source.objects.create(name="BBC Tech", url="https://feeds.bbci.co.uk/news/technology/rss.xml")

    assert world.publisher_domain == tech.publisher_domain == "bbci.co.uk"

    now = timezone.now()
    story = Story.objects.create(title="An Event", slug="an-event", first_seen_at=now)
    for i, src in enumerate((world, tech)):
        Article.objects.create(
            source=src, story=story, title=f"An Event {i}",
            url=f"https://bbc.co.uk/{i}", published_date=now,
        )

    source_count, independent_count, _ = _recount_cluster(story)
    assert source_count == 2
    assert independent_count == 1, "same publisher must not self-corroborate"


@pytest.mark.django_db
def test_distinct_publishers_do_corroborate(db):
    from core.clustering import _recount_cluster, compute_tier

    now = timezone.now()
    story = Story.objects.create(title="An Event", slug="an-event-2", first_seen_at=now)
    for i, host in enumerate(("bbci.co.uk", "nytimes.com", "theguardian.com")):
        src = Source.objects.create(name=host, url=f"https://feeds.{host}/rss")
        Article.objects.create(
            source=src, story=story, title=f"An Event {i}",
            url=f"https://{host}/{i}", published_date=now,
        )

    _, independent_count, _ = _recount_cluster(story)
    assert independent_count == 3
    assert compute_tier(independent_count, 0.0, False) == Story.Status.CORROBORATED


# ==========================================================================
# Article.slug: unique + blank with no generation
# ==========================================================================

@pytest.mark.django_db
def test_articles_get_unique_slugs_without_explicit_assignment(source):
    """
    slug is unique and blank=True with no default. Only the ingest task built
    one, so any other write path produced '' and the second row raised
    UniqueViolation.
    """
    now = timezone.now()
    a = Article.objects.create(
        source=source, title="Identical Headline",
        url="https://example-a.com/a", published_date=now,
    )
    b = Article.objects.create(
        source=source, title="Identical Headline",
        url="https://example-a.com/b", published_date=now,
    )

    assert a.slug and b.slug
    assert a.slug != b.slug


# ==========================================================================
# Rate limiter trusted a client-controlled header
# ==========================================================================

@pytest.mark.django_db
def test_client_ip_ignores_forwarded_header_when_proxy_untrusted(settings, rf):
    """
    X-Forwarded-For was read unconditionally, so spoofing it gave a caller an
    unlimited number of distinct rate-limit buckets.
    """
    from api.api import client_ip

    settings.TRUST_PROXY_HEADERS = False
    request = rf.get("/", HTTP_X_FORWARDED_FOR="1.2.3.4", REMOTE_ADDR="10.0.0.9")
    assert client_ip(request) == "10.0.0.9"


@pytest.mark.django_db
def test_client_ip_skips_client_prepended_hops_when_proxy_trusted(settings, rf):
    """With one trusted proxy, the client IP is the rightmost entry it appended."""
    from api.api import client_ip

    settings.TRUST_PROXY_HEADERS = True
    settings.TRUSTED_PROXY_COUNT = 1
    request = rf.get(
        "/",
        HTTP_X_FORWARDED_FOR="spoofed, 203.0.113.7",
        REMOTE_ADDR="10.0.0.9",
    )
    assert client_ip(request) == "203.0.113.7"


# ==========================================================================
# Feed pagination keyed on a continuously-mutating column
# ==========================================================================

@pytest.mark.django_db
def test_feed_pagination_is_stable_when_velocity_changes(client, source):
    """
    Paging the feed used to order by velocity_score, which the clustering worker
    rewrites every few minutes. Rows crossed the cursor boundary between
    requests, so a reader scrolling saw stories repeat and others disappear.

    Ordering now keys on (first_seen_at, id), which never changes once a story
    exists — so mutating every velocity mid-scroll must not disturb paging.
    """
    now = timezone.now()
    for i in range(9):
        story = Story.objects.create(
            title=f"Story {i}", slug=f"story-{i}",
            first_seen_at=now - timedelta(hours=i),
            velocity_score=float(i),
        )
        Article.objects.create(
            source=source, story=story, title=f"Story {i}",
            url=f"https://example-a.com/s{i}", published_date=story.first_seen_at,
        )

    first = client.get("/api/v1/stories?limit=3").json()
    assert len(first["items"]) == 3
    cursor = first["next_cursor"]
    assert cursor

    # Simulate the clustering worker rewriting every velocity between requests.
    for idx, story in enumerate(Story.objects.all()):
        story.velocity_score = 100.0 - idx
        story.save(update_fields=["velocity_score"])

    second = client.get(f"/api/v1/stories?limit=3&cursor={cursor}").json()

    first_slugs = [i["slug"] for i in first["items"]]
    second_slugs = [i["slug"] for i in second["items"]]

    assert not set(first_slugs) & set(second_slugs), "page 2 repeated page 1 entries"
    assert len(second_slugs) == 3, "stories were skipped across the boundary"


@pytest.mark.django_db
def test_velocity_sort_is_a_single_ranked_page(client, source):
    """velocity ordering is a snapshot; it must not hand out a paging cursor."""
    now = timezone.now()
    for i in range(5):
        Story.objects.create(
            title=f"V{i}", slug=f"v-{i}",
            first_seen_at=now - timedelta(hours=i),
            velocity_score=float(i),
        )

    payload = client.get("/api/v1/stories?sort=velocity&limit=3").json()

    assert payload["sort"] == "velocity"
    assert payload["next_cursor"] is None
    scores = [i["velocity_score"] for i in payload["items"]]
    assert scores == sorted(scores, reverse=True)


# ==========================================================================
# Velocity had two conflicting definitions
# ==========================================================================

@pytest.mark.django_db
def test_velocity_is_publishers_per_hour(db):
    from core.clustering import compute_velocity

    four_hours_ago = timezone.now() - timedelta(hours=4)
    assert compute_velocity(8, four_hours_ago) == pytest.approx(2.0, rel=1e-3)

    # A story breaking right now must not divide by ~zero.
    assert compute_velocity(3, timezone.now() + timedelta(seconds=1)) == 3.0
