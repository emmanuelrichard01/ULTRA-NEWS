from datetime import timedelta

from unittest.mock import patch

import pytest
from django.utils import timezone

from core.clustering import (
    TOKEN_MATCH_THRESHOLD,
    TokenOverlapScorer,
    cluster_article,
)
from core.models import Article, Category, Source, Story


@pytest.fixture
def base_source():
    return Source.objects.create(name="Test Source", url="http://test.com")

@pytest.fixture
def secondary_source():
    return Source.objects.create(name="Another Source", url="http://another.com")

@pytest.fixture
def category():
    return Category.objects.create(name="Test Category", slug="test")

@pytest.mark.django_db
def test_token_overlap_scorer_similarity(base_source, category):
    now = timezone.now()
    story = Story.objects.create(
        title="Central Bank Holds Rates Steady Amid Inflation Concerns",
        slug="central-bank",
        first_seen_at=now,
    )
    
    Article.objects.create(
        source=base_source,
        title="Policymakers Maintain Interest Rate for Third Straight Meeting",
        url="http://test.com/1",
        published_date=now,
    )
    
    Article.objects.create(
        source=base_source,
        title="CBN Keeps Benchmark Rate Unchanged",
        url="http://test.com/2",
        published_date=now,
    )
    
    article3 = Article.objects.create(
        source=base_source,
        title="Central Bank Keeps Rates Unchanged",
        url="http://test.com/3",
        published_date=now,
    )

    scorer = TokenOverlapScorer()

    # "Central Bank Keeps Rates Unchanged" vs
    # "Central Bank Holds Rates Steady Amid Inflation Concerns"
    #   article tokens: {central, bank, keep, rate, unchanged}          -> 5
    #   story tokens:   {central, bank, hold, rate, steady, amid,
    #                    inflation, concern}                            -> 8
    #   shared:         {central, bank, rate}                           -> 3
    #
    # Overlap coefficient: 3 / min(5, 8) = 0.60, comfortably over the threshold.
    # Under the old Jaccard metric this was 3 / 10 = 0.30 — beneath the 0.35
    # threshold the code used, so a plainly matching pair was rejected. (The
    # comment here previously claimed 3/7, having overlooked the article's own
    # unique tokens in the union.)
    score3 = scorer.similarity(article3, story)
    assert score3 == pytest.approx(0.6), score3
    assert score3 >= TOKEN_MATCH_THRESHOLD

    # A headline sharing only one incidental content word must not match.
    unrelated = Article.objects.create(
        source=base_source,
        title="Bank Holiday Traffic Snarls Motorways",
        url="http://test.com/4",
        published_date=now,
    )
    assert scorer.similarity(unrelated, story) == 0.0

@pytest.mark.django_db
def test_cluster_article_merges_on_similarity(base_source, secondary_source, category):
    now = timezone.now()
    scorer = TokenOverlapScorer()
    
    a1 = Article.objects.create(
        source=base_source,
        title="Central Bank Holds Rates Steady Amid Inflation Concerns",
        url="http://test.com/1",
        published_date=now,
    )
    a1.categories.add(category)
    
    # First article creates new story
    story1 = cluster_article(a1, scorer)
    assert story1.source_count == 1
    assert story1.independent_count == 1
    
    a2 = Article.objects.create(
        source=secondary_source,
        title="Central Bank Keeps Rates Unchanged",
        url="http://another.com/1",
        published_date=now + timedelta(minutes=10),
    )
    a2.categories.add(category)
    
    # Second article should merge into the same story
    story2 = cluster_article(a2, scorer)
    assert story1.id == story2.id
    assert story2.independent_count == 2
    assert story2.status == Story.Status.DEVELOPING # 2 sources -> Developing


# ==========================================================================
# Task dispatch
# ==========================================================================

@pytest.mark.django_db
def test_synthesis_is_not_dispatched_when_dispatch_is_disabled():
    """
    The regression guard for a 25-minute pipeline timeout.

    `.delay()` against an unreachable broker does not fail fast — it retries,
    blocking 5.9s locally and ~39s on a CI runner before raising. Clustering
    calls it once per promoted story, so on a deployment with no worker that
    cost was paid hundreds of times per run for work nothing could consume.
    The exception was caught and logged, which hid the failure without making
    it any cheaper.
    """
    from django.test import override_settings

    from core.clustering import _dispatch_synthesis

    with override_settings(CELERY_DISPATCH_ENABLED=False):
        with patch("core.tasks.synthesize_story_brief.delay") as delay:
            _dispatch_synthesis(1)

    assert not delay.called, "dispatch must be skipped when no worker can consume it"


@pytest.mark.django_db(transaction=True)
def test_synthesis_is_dispatched_when_a_worker_is_expected():
    """The default path must still queue work — this is opt-out, not opt-in."""
    from django.test import override_settings

    from core.clustering import _dispatch_synthesis

    with override_settings(CELERY_DISPATCH_ENABLED=True):
        with patch("core.tasks.synthesize_story_brief.delay") as delay:
            _dispatch_synthesis(1)

    delay.assert_called_once_with(1)
