"""
Clustering threshold calibration guards.

The original version of this file asserted fixed bounds (>= 0.80 same-event,
<= 0.79 different-event) that were internally unsatisfiable, and it only ever
looked at four hand-picked pairs. Four pairs cannot tell you whether a threshold
merges unrelated events across a real feed — the pairs that actually break
clustering are same-topic different-event headlines, and they only show up at
corpus scale.

The pairs below carry scores measured on BAAI/bge-small-en-v1.5 against a live
500-article corpus. The important property is PRECISION: no different-event pair
may reach the clustering threshold. A missed merge costs a corroboration; a false
merge invents one, which for this product is the far worse failure.

Use `python manage.py calibrate_threshold` to re-derive these numbers whenever
the embedding model or threshold changes.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from core.clustering import (
    EMBEDDING_MATCH_THRESHOLD,
    EmbeddingScorer,
    get_embedding_model,
)
from core.models import Article, Source, Story

# Same event, reported by different outlets in the usual wire-syndication style.
# This is what the great majority of real corroboration looks like, and these
# MUST cluster.
NEAR_DUPLICATE_PAIRS = [
    (
        "brazil_ambassador_visa",
        "US revokes visa of Brazilian ambassador amid deepening diplomatic spat",
        "White House revokes visa of Brazil's ambassador to US",
    ),
    (
        "channel_migrant_rescue",
        "More Than 170 Migrants Rescued From Burning Boat in English Channel",
        "More than 170 migrants rescued after boat catches fire in Channel",
    ),
    (
        "moscow_drone_strike",
        "Ukraine drone strikes kill five near Moscow, Russia says",
        "Ukraine hits more Wildberries sites as strike kills five in Moscow region",
    ),
]

# Different events. Several share a topic and vocabulary, which is exactly what
# drags unrelated stories into one cluster. NONE may reach the threshold.
DIFFERENT_EVENT_PAIRS = [
    (
        "ai_opinion_pieces",
        "When China's open-source AI is a trap",
        "Sovereign AI, independent of America and China, is a pipe dream",
    ),
    (
        "separate_drone_incidents",
        "Ukraine drone strikes kill five near Moscow, Russia says",
        "Drone Explodes on Russian Beach, Killing 7, Officials Say",
    ),
    (
        "canada_us_diplomacy",
        "U.S. State Department to close consulate in Winnipeg, sources say",
        "Canada cuts its UN peacekeeping forces as it tilts to Europe and Indo-Pacific",
    ),
    (
        "unrelated_commentary",
        "Donald Trump could be the man to save Cuba",
        "Why strongmen are wrong to loathe Europe",
    ),
    (
        "cbn_different_event",
        "CBN Retains Benchmark Interest Rate at 27.25% Amid Inflation Concerns",
        "Central Bank Appoints New Deputy Governor for Financial Stability",
    ),
    (
        "openai_different_event",
        "OpenAI Unveils New Flagship AI System Globally",
        "OpenAI Faces Copyright Lawsuit from Publishing Consortium",
    ),
]

# Same event, but reworded with entirely different vocabulary. These score BELOW
# the threshold and therefore do not cluster. Documented deliberately: an
# unrelated AI-topic pair scores 0.730 while the CBN paraphrase scores 0.727, so
# the classes overlap and no threshold can catch these without also merging
# unrelated stories. This is a recall ceiling of the model on short headlines.
KNOWN_UNMATCHED_PARAPHRASES = [
    (
        "cbn_apex_bank",
        "CBN Retains Benchmark Interest Rate at 27.25% Amid Inflation Concerns",
        "Apex Bank Keeps Monetary Policy Rate Unchanged at 27.25 Percent",
    ),
    (
        "openai_altman",
        "OpenAI Unveils New Flagship AI System Globally",
        "Sam Altman Announces Next-Generation AI Model Release",
    ),
]


@pytest.fixture
def source(db):
    return Source.objects.create(name="Test Financial Wire", url="http://testwire.com")


def _score(scorer, source, idx, headline_a, headline_b):
    """Embed both headlines and score them exactly as clustering would."""
    model = get_embedding_model()
    if not model:
        pytest.skip("fastembed unavailable")

    now = timezone.now()
    vec = lambda t: [float(x) for x in list(model.embed([t]))[0]]  # noqa: E731

    story = Story.objects.create(
        title=headline_a, slug=f"bench-{idx}", first_seen_at=now, embedding=vec(headline_a),
    )
    article = Article.objects.create(
        source=source, title=headline_b, url=f"http://testwire.com/bench-{idx}",
        published_date=now, embedding=vec(headline_b),
    )
    return scorer.similarity(article, story)


@pytest.mark.django_db
@pytest.mark.parametrize("pair_id,a,b", NEAR_DUPLICATE_PAIRS)
def test_wire_syndication_pairs_cluster(source, pair_id, a, b):
    """The common corroboration case must clear the threshold."""
    score = _score(EmbeddingScorer(), source, abs(hash(pair_id)) % 10000, a, b)
    assert score >= EMBEDDING_MATCH_THRESHOLD, (
        f"'{pair_id}' scored {score:.4f}, below threshold {EMBEDDING_MATCH_THRESHOLD}. "
        f"Real multi-outlet coverage of one event would fragment into single-source "
        f"entries and never be promoted past Wire."
    )


@pytest.mark.django_db
@pytest.mark.parametrize("pair_id,a,b", DIFFERENT_EVENT_PAIRS)
def test_different_events_never_cluster(source, pair_id, a, b):
    """
    The precision guard, and the one that matters most.

    Lowering the threshold until these pass is exactly how the feed ends up with
    a single 112-article cluster of unrelated geopolitics presented to readers as
    one corroborated story.
    """
    score = _score(EmbeddingScorer(), source, 5000 + abs(hash(pair_id)) % 10000, a, b)
    assert score < EMBEDDING_MATCH_THRESHOLD, (
        f"'{pair_id}' scored {score:.4f}, at or above threshold "
        f"{EMBEDDING_MATCH_THRESHOLD}. Unrelated events would be merged and "
        f"presented as mutually corroborating."
    )


@pytest.mark.django_db
@pytest.mark.parametrize("pair_id,a,b", KNOWN_UNMATCHED_PARAPHRASES)
def test_known_recall_gap_is_still_a_gap(source, pair_id, a, b):
    """
    Documents the recall ceiling rather than pretending it isn't there.

    If a future embedding model lifts these above the threshold, this test fails
    — which is the signal to re-run `manage.py calibrate_threshold` and confirm
    precision held before celebrating the extra recall.
    """
    score = _score(EmbeddingScorer(), source, 9000 + abs(hash(pair_id)) % 900, a, b)
    assert score < EMBEDDING_MATCH_THRESHOLD, (
        f"'{pair_id}' now scores {score:.4f}, at or above {EMBEDDING_MATCH_THRESHOLD}. "
        f"Recall improved — re-run calibrate_threshold and verify no different-event "
        f"pair crossed the threshold too, then move this pair to NEAR_DUPLICATE_PAIRS."
    )


@pytest.mark.django_db
def test_embedding_scorer_time_window_enforcement(source):
    now = timezone.now()
    v = [0.9] * 384

    story = Story.objects.create(
        title="Historical Financial Policy Announcement",
        slug="history-policy",
        first_seen_at=now - timedelta(days=5),  # 120 hours ago (> 72h window)
        embedding=v,
    )
    article = Article.objects.create(
        source=source,
        title="Historical Financial Policy Announcement",
        url="http://testwire.com/history",
        published_date=now,
        embedding=list(v),
    )

    # Even with identical embeddings, the 72h window must reject the match.
    assert EmbeddingScorer().similarity(article, story) == 0.0
