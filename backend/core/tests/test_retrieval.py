"""
Story-level retrieval and the semantic answer cache.

The original /ask took the five articles nearest the query vector. On real data a
well-covered event has a dozen near-identical articles, so all five slots filled
with one story and everything else was crowded out — and corroboration, the one
thing this product measures, played no part in what grounded the answer.
"""
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone

from core.models import Article, Source, Story


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def embed():
    from core.clustering import get_embedding_model

    model = get_embedding_model()
    if model is None:
        pytest.skip("fastembed unavailable")
    return lambda text: [float(x) for x in list(model.embed([text]))[0]]


def _story_with_articles(embed, slug, title, outlets, age_hours=1, headlines=None):
    """Create a story cluster carrying one article per named outlet."""
    first_seen = timezone.now() - timedelta(hours=age_hours)
    story = Story.objects.create(
        title=title, slug=slug, summary=title,
        first_seen_at=first_seen,
        independent_count=len(outlets), source_count=len(outlets),
        embedding=embed(title),
    )
    for i, outlet in enumerate(outlets):
        source, _ = Source.objects.get_or_create(
            url=f"https://feeds.{outlet}.com/rss",
            defaults={"name": outlet, "trust_tier": Source.TrustTier.AUTO_PUBLISH},
        )
        source.trust_tier = Source.TrustTier.AUTO_PUBLISH
        source.save(update_fields=["trust_tier"])
        headline = (headlines or {}).get(outlet, title)
        Article.objects.create(
            source=source, story=story, title=headline,
            url=f"https://{outlet}.com/{slug}-{i}",
            published_date=first_seen,
            embedding=embed(headline),
        )
    return story


@pytest.mark.django_db
def test_retrieval_returns_distinct_stories_not_duplicate_articles(embed):
    """
    One heavily-covered event must not consume every context slot.

    Article-level retrieval returned five near-identical articles about a single
    story; the reader's question about anything else went unanswered despite the
    corpus holding relevant reporting.
    """
    from core.services.retrieval import retrieve_stories

    # Eight outlets on one event, plus two other events on the same theme.
    _story_with_articles(embed, "big-event", "Ukraine drone strikes kill five near Moscow",
                         [f"outlet{i}" for i in range(8)])
    _story_with_articles(embed, "second", "Ukraine ceasefire negotiations resume in Geneva", ["alpha", "beta"])
    _story_with_articles(embed, "third", "Russia expands conscription across border regions", ["gamma"])

    results = retrieve_stories(embed("What is happening with Ukraine?"), limit=3)

    slugs = [r.slug for r in results]
    assert len(slugs) == len(set(slugs)), f"duplicate stories returned: {slugs}"
    assert len(results) >= 2, "retrieval collapsed onto a single story"


@pytest.mark.django_db
def test_corroborated_story_outranks_single_source_at_equal_relevance(embed):
    """
    Corroboration must influence what grounds an answer.

    Two stories about the same thing, one carried by six independent outlets and
    one by a single outlet: the corroborated one should ground the answer.
    """
    from core.services.retrieval import retrieve_stories

    headline = "Central bank holds interest rates steady"
    _story_with_articles(embed, "single", headline, ["lonely"])
    _story_with_articles(embed, "corroborated", headline,
                         [f"major{i}" for i in range(6)])

    results = retrieve_stories(embed("Did the central bank change interest rates?"), limit=2)

    assert results[0].slug == "corroborated", (
        f"single-source story outranked six-outlet corroboration: "
        f"{[(r.slug, round(r.score, 3)) for r in results]}"
    )


@pytest.mark.django_db
def test_recent_story_outranks_stale_one_at_equal_relevance(embed):
    """News answers are time-sensitive; age must break ties."""
    from core.services.retrieval import retrieve_stories

    headline = "Flooding forces evacuations along the river delta"
    _story_with_articles(embed, "stale", headline, ["a", "b"], age_hours=200)
    _story_with_articles(embed, "fresh", headline, ["c", "d"], age_hours=1)

    results = retrieve_stories(embed("What is the latest flooding news?"), limit=2)
    assert results[0].slug == "fresh"


@pytest.mark.django_db
def test_context_states_corroboration_level(embed):
    """
    The grounding context must carry corroboration, or the model cannot qualify
    its answer — which is the distinction this product exists to draw.
    """
    from core.services.retrieval import build_context, retrieve_stories

    _story_with_articles(embed, "unconfirmed", "Explosion reported at industrial site", ["only"])
    context = build_context(retrieve_stories(embed("explosion industrial site"), limit=1))

    assert "SINGLE SOURCE" in context
    assert "not independently confirmed" in context


# ==========================================================================
# Semantic answer cache
# ==========================================================================

@pytest.mark.django_db
def test_cache_hits_on_a_paraphrase(embed):
    """
    Readers converge on whatever is happening today, phrased many ways. Exact
    string caching would miss all of it.
    """
    from core.services import answer_cache

    original = "What is the latest on Ukraine drone strikes?"
    answer_cache.store(original, embed(original), "Five were killed near Moscow.", ["BBC"], "llm")

    hit = answer_cache.lookup(embed("Whats the latest on Ukraine drone strikes"))
    assert hit is not None
    assert hit["answer"] == "Five were killed near Moscow."
    assert hit["cached"] is True


@pytest.mark.django_db
def test_cache_misses_on_a_genuinely_different_question(embed):
    """
    Serving one story's answer for another question would be a factual error,
    not an approximation — the threshold is deliberately strict.
    """
    from core.services import answer_cache

    stored = "What is the latest on Ukraine drone strikes?"
    answer_cache.store(stored, embed(stored), "Five were killed near Moscow.", ["BBC"], "llm")

    assert answer_cache.lookup(embed("What did the central bank decide about interest rates?")) is None


@pytest.mark.django_db
def test_new_reporting_invalidates_cached_answers(embed):
    """
    A cached answer about a developing story is wrong the moment fresh coverage
    lands. On a news product a stale answer is worse than a slow one.
    """
    from core.services import answer_cache

    query = "What is the latest on Ukraine drone strikes?"
    answer_cache.store(query, embed(query), "Five were killed.", ["BBC"], "llm")
    assert answer_cache.lookup(embed(query)) is not None

    answer_cache.invalidate_all()
    assert answer_cache.lookup(embed(query)) is None


# ==========================================================================
# Synthesis regeneration policy
# ==========================================================================

@pytest.mark.django_db
def test_resynthesis_requires_new_independent_outlets():
    """
    Another article from an outlet already in the cluster changes the
    multi-source picture very little. Regeneration used to trigger on article
    count, paying full price to alter a sentence.
    """
    from core.clustering import _should_resynthesize

    story = Story.objects.create(
        title="Event", slug="event", first_seen_at=timezone.now(),
        status=Story.Status.CORROBORATED,
        synthesis_status=Story.SynthesisStatus.COMPLETED,
        synthesized_at=timezone.now() - timedelta(hours=2),
        independent_count=4, synthesis_independent_count=4,
        source_count=20, synthesis_source_count=6,
    )
    # 14 new articles but no new outlets — not worth regenerating.
    assert _should_resynthesize(story) is False

    story.independent_count = 6  # two new outlets
    assert _should_resynthesize(story) is True


@pytest.mark.django_db
def test_resynthesis_respects_cooldown():
    """A fast-moving story must not regenerate its brief every few minutes."""
    from core.clustering import _should_resynthesize

    story = Story.objects.create(
        title="Fast", slug="fast", first_seen_at=timezone.now(),
        status=Story.Status.CORROBORATED,
        synthesis_status=Story.SynthesisStatus.COMPLETED,
        synthesized_at=timezone.now(),  # just synthesised
        independent_count=10, synthesis_independent_count=4,
    )
    assert _should_resynthesize(story) is False


@pytest.mark.django_db
def test_first_synthesis_happens_as_soon_as_a_story_leaves_wire():
    from core.clustering import _should_resynthesize

    story = Story.objects.create(
        title="New", slug="new", first_seen_at=timezone.now(),
        status=Story.Status.DEVELOPING,
        synthesis_status=Story.SynthesisStatus.IDLE,
        independent_count=2,
    )
    assert _should_resynthesize(story) is True
