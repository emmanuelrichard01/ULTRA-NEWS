"""Trust graph aggregation."""
import pytest
from django.utils import timezone

from core.models import Article, Source, Story
from core.trust import compute_trust_graph


@pytest.mark.django_db
def test_trust_graph_scores_corroboration_and_scoops():
    now = timezone.now()

    breaker = Source.objects.create(name="Breaker", url="https://feeds.breaker.com/rss")
    follower = Source.objects.create(name="Follower", url="https://feeds.follower.com/rss")
    noise = Source.objects.create(name="Noise", url="https://feeds.noise.com/rss")

    corroborated = Story.objects.create(
        title="Confirmed Event", slug="confirmed-event",
        first_seen_at=now, status=Story.Status.CORROBORATED,
    )
    wire_only = Story.objects.create(
        title="Unconfirmed Event", slug="unconfirmed-event",
        first_seen_at=now, status=Story.Status.WIRE,
    )

    # Breaker reported the corroborated story first.
    Article.objects.create(
        source=breaker, story=corroborated, title="Breaker first",
        url="https://breaker.com/1", published_date=now,
        is_primary_source=True,
    )
    Article.objects.create(
        source=follower, story=corroborated, title="Follower after",
        url="https://follower.com/1", published_date=now,
    )
    # Noise only ever contributed to a story that never got corroborated.
    Article.objects.create(
        source=noise, story=wire_only, title="Noise alone",
        url="https://noise.com/1", published_date=now,
    )

    compute_trust_graph()

    breaker.refresh_from_db()
    follower.refresh_from_db()
    noise.refresh_from_db()

    assert breaker.corroboration_rate == pytest.approx(100.0)
    assert breaker.articles_broken_first == 1

    assert follower.corroboration_rate == pytest.approx(100.0)
    assert follower.articles_broken_first == 0, "did not report first"

    assert noise.corroboration_rate == pytest.approx(0.0)
    assert noise.articles_broken_first == 0


@pytest.mark.django_db
def test_trust_graph_ignores_sources_with_no_articles():
    """A source with no articles must not produce a divide-by-zero."""
    empty = Source.objects.create(name="Empty", url="https://feeds.empty.com/rss")

    compute_trust_graph()

    empty.refresh_from_db()
    assert empty.corroboration_rate == 0.0
