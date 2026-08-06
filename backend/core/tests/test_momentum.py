"""
Materialised momentum.

The interesting property is DECAY. Momentum falls as the window slides with no
write to the story at all, so a value that is merely cached — refreshed only
when an article joins — would leave yesterday's news pinned to the top of the
Developing edition forever.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from core.models import Article, Source, Story
from core.momentum import MOMENTUM_WINDOW_HOURS, refresh_momentum


@pytest.fixture
def outlets(db):
    return [
        Source.objects.create(
            name=f"Outlet {i}",
            url=f"https://feeds.outlet{i}.test/rss",
            trust_tier=Source.TrustTier.AUTO_PUBLISH,
        )
        for i in range(5)
    ]


def _story(slug, outlets, *, published_hours_ago, count=3):
    published = timezone.now() - timedelta(hours=published_hours_ago)
    story = Story.objects.create(
        title=slug, slug=slug, first_seen_at=published,
        independent_count=count, source_count=count,
    )
    for i in range(count):
        Article.objects.create(
            source=outlets[i], story=story, title=f"{slug} {i}",
            url=f"https://outlet{i}.test/{slug}", published_date=published,
        )
    return story


@pytest.mark.django_db
def test_momentum_counts_publishers_inside_the_window(outlets):
    story = _story("fresh", outlets, published_hours_ago=1, count=3)

    refresh_momentum()
    story.refresh_from_db()

    assert story.momentum_outlets == 3
    assert story.momentum_computed_at is not None


@pytest.mark.django_db
def test_momentum_decays_when_the_window_slides(outlets):
    """
    The property that makes this more than a cache.

    Nothing writes to an ageing story, so a refresh triggered only by new
    articles would never notice it had fallen out of the window.
    """
    story = _story("ageing", outlets, published_hours_ago=1, count=4)
    refresh_momentum()
    story.refresh_from_db()
    assert story.momentum_outlets == 4

    # Age every article out of the window without touching the story row.
    Article.objects.filter(story=story).update(
        published_date=timezone.now() - timedelta(hours=MOMENTUM_WINDOW_HOURS + 3)
    )

    refresh_momentum()
    story.refresh_from_db()
    assert story.momentum_outlets == 0, "momentum did not decay out of the window"


@pytest.mark.django_db
def test_momentum_counts_publishers_not_articles(outlets):
    """One newsroom filing repeatedly is one outlet, not several."""
    published = timezone.now() - timedelta(hours=1)
    story = Story.objects.create(
        title="Repeated", slug="repeated", first_seen_at=published,
        independent_count=1, source_count=4,
    )
    for i in range(4):
        Article.objects.create(
            source=outlets[0], story=story, title=f"Update {i}",
            url=f"https://outlet0.test/repeated-{i}", published_date=published,
        )

    refresh_momentum()
    story.refresh_from_db()
    assert story.momentum_outlets == 1


@pytest.mark.django_db
def test_momentum_ignores_unpublishable_sources(outlets):
    """A source in the review queue must not contribute corroboration."""
    published = timezone.now() - timedelta(hours=1)
    hidden = Source.objects.create(
        name="Review", url="https://feeds.review.test/rss",
        trust_tier=Source.TrustTier.REVIEW_QUEUE,
    )
    story = Story.objects.create(
        title="Mixed", slug="mixed", first_seen_at=published,
        independent_count=2, source_count=2,
    )
    Article.objects.create(
        source=outlets[0], story=story, title="Visible",
        url="https://outlet0.test/mixed", published_date=published,
    )
    Article.objects.create(
        source=hidden, story=story, title="Hidden",
        url="https://review.test/mixed", published_date=published,
    )

    refresh_momentum()
    story.refresh_from_db()
    assert story.momentum_outlets == 1


@pytest.mark.django_db
def test_targeted_refresh_updates_only_named_stories(outlets):
    a = _story("targeted-a", outlets, published_hours_ago=1, count=2)
    b = _story("targeted-b", outlets, published_hours_ago=1, count=3)

    refresh_momentum([a.pk])

    a.refresh_from_db()
    b.refresh_from_db()
    assert a.momentum_outlets == 2
    assert b.momentum_outlets == 0, "untargeted story should not have been touched"


@pytest.mark.django_db
def test_developing_edition_reads_the_materialised_column(client, outlets):
    """
    End-to-end: the edition ranks on the column, and reports it to the UI so a
    card can say "4 new outlets" rather than showing an abstract score.
    """
    _story("hot", outlets, published_hours_ago=1, count=4)
    _story("warm", outlets, published_hours_ago=2, count=2)
    _story("cold", outlets, published_hours_ago=MOMENTUM_WINDOW_HOURS + 5, count=3)

    refresh_momentum()

    payload = client.get("/api/v1/stories?sort=momentum&limit=10").json()
    slugs = [item["slug"] for item in payload["items"]]

    assert slugs[:2] == ["hot", "warm"], slugs
    assert "cold" not in slugs, "a story outside the window is not developing"
    assert payload["items"][0]["recent_outlets"] == 4
