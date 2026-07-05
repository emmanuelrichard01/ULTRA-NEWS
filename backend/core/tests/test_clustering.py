from datetime import timedelta
from django.utils import timezone
import pytest
from core.models import Source, Category, Article, Story
from core.clustering import TokenOverlapScorer, cluster_article

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
    
    article1 = Article.objects.create(
        source=base_source,
        title="Policymakers Maintain Interest Rate for Third Straight Meeting",
        url="http://test.com/1",
        published_date=now,
    )
    
    article2 = Article.objects.create(
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
    
    # "Central Bank Keeps Rates Unchanged" should match "Central Bank Holds Rates Steady Amid Inflation Concerns"
    # Overlap: "central", "bank", "rate" vs "central", "bank", "rate", "steady", "amid", "inflation", "concern"
    # Jaccard index: 3 / 7 > 0.35
    score3 = scorer.similarity(article3, story)
    assert score3 > 0.35

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
