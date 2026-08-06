"""
Topic classification.

Keyword matching left 47% of a 619-article corpus with no topic at all, put 2
articles in "art", and filed "Hong Kong can look to San Francisco" under
Technology. These tests lock in the properties that made it a toy.
"""
import re
from pathlib import Path

import pytest

from core.topics import (
    SECONDARY_TOPIC_MARGIN,
    TOPICS,
    TOPICS_BY_SLUG,
    classify,
    score_topics,
)


@pytest.fixture(scope="module")
def embed():
    from core.clustering import get_embedding_model

    model = get_embedding_model()
    if model is None:
        pytest.skip("fastembed unavailable")
    return lambda text: [float(x) for x in list(model.embed([text]))[0]]


# Headlines drawn from the live corpus, with the topic a person would pick.
LABELLED_HEADLINES = [
    ("Abdul El-Sayed wins Michigan Democratic primary for Senate", "politics"),
    ("Taiwan investigates 17 Chinese firms for suspected poaching of chip talent", "tech"),
    ("What happens next with Rashford and Man Utd?", "sports"),
    ("Russian strikes kill 17 in Kyiv region as Ukraine fails to stop missiles", "world"),
    ("Stakeholders flag safety risks in CNG and EV transition", "climate"),
    ("FG sets 2027 target for 24-hour hospital power supply", "health"),
    ("Wall Street rallies as Federal Reserve signals rate cut", "business"),
    ("Astronomers detect water vapour on distant exoplanet", "science"),
]


@pytest.mark.parametrize("headline,expected", LABELLED_HEADLINES)
def test_headlines_classify_to_the_right_topic(embed, headline, expected):
    """The top-ranked topic should be the one a person would choose."""
    ranked = score_topics(embed(headline))
    assert ranked, "classifier returned nothing"
    assert ranked[0][0] == expected, (
        f"'{headline}' ranked as {ranked[0][0]} ({ranked[0][1]:.3f}); "
        f"expected {expected}. Full ranking: {ranked[:3]}"
    )


def test_coverage_is_near_total(embed):
    """
    Nearly every real headline should receive a topic.

    Coverage is the metric keyword matching failed on: it tagged 53% of
    articles. Classification is argmax-with-a-floor precisely so that a headline
    which is clearly about something does not fall through for lacking the
    listed vocabulary.
    """
    tagged = sum(1 for headline, _ in LABELLED_HEADLINES if classify(embed(headline)))
    assert tagged == len(LABELLED_HEADLINES)


def test_articles_are_not_smeared_across_the_taxonomy(embed):
    """At most two topics, and a second only when it's genuinely close."""
    for headline, _ in LABELLED_HEADLINES:
        chosen = classify(embed(headline))
        assert len(chosen) <= 2, f"'{headline}' got {len(chosen)} topics"
        if len(chosen) == 2:
            assert (chosen[0][1] - chosen[1][1]) <= SECONDARY_TOPIC_MARGIN


# Filler that RSS feeds genuinely emit: navigation crumbs, truncation markers,
# subscription calls-to-action, entity-only titles. These must never be tagged.
FEED_BOILERPLATE = [
    "...",
    "Read more",
    "Click here to subscribe to our newsletter",
    "aaaa bbbb cccc dddd",
]


@pytest.mark.parametrize("text", FEED_BOILERPLATE)
def test_feed_boilerplate_is_not_force_fitted_to_a_topic(embed, text):
    """
    Boilerplate must receive no topic.

    This cannot be done with an absolute-score floor: "..." scores 0.688 against
    Technology, higher than a real story about missile strikes at 0.474. The gate
    is distinctiveness — filler scores flat across every topic.
    """
    assert classify(embed(text)) == [], (
        f"{text!r} was classified; ranking was {score_topics(embed(text))[:3]}"
    )


def test_distinctiveness_gate_sits_in_the_measured_gap(embed):
    """
    The gate must separate real headlines from feed boilerplate, with margin on
    both sides so ordinary variation doesn't flip a decision.
    """
    from core.topics import TOPIC_DISTINCTIVENESS_MIN, distinctiveness

    real = [distinctiveness(score_topics(embed(h))) for h, _ in LABELLED_HEADLINES]
    filler = [distinctiveness(score_topics(embed(t))) for t in FEED_BOILERPLATE]

    assert max(filler) < TOPIC_DISTINCTIVENESS_MIN <= min(real), (
        f"gate {TOPIC_DISTINCTIVENESS_MIN} sits outside the measured gap "
        f"[{max(filler):.3f}, {min(real):.3f}]"
    )


def test_adversarial_gibberish_is_a_known_limitation(embed):
    """
    Random character strings are NOT reliably rejected, and this documents it
    rather than pretending otherwise.

    "asdf qwerty zxcv 12345" scores 0.057 distinctiveness — above real feed
    boilerplate (max 0.048) and only 0.002 below the quietest genuine headline
    (0.059). No gate separates it without also discarding real short headlines,
    and tuning to that 0.002 margin would be fitting to one artificial sample.

    The tradeoff is deliberate: random character strings do not appear in RSS
    feeds, and the cost of being wrong is a single mis-tagged item, whereas
    raising the gate drops real coverage — the exact failure that made the
    keyword classifier useless at 47% untagged.
    """
    from core.topics import TOPIC_DISTINCTIVENESS_MIN, distinctiveness

    score = distinctiveness(score_topics(embed("asdf qwerty zxcv 12345")))
    assert score >= TOPIC_DISTINCTIVENESS_MIN, (
        f"gibberish now scores {score:.3f}, below the gate — the model or "
        f"prototypes improved. Fold this case into FEED_BOILERPLATE."
    )


def test_every_topic_has_prototypes():
    """A topic with no prototypes can never be assigned — that was 'art'."""
    for topic in TOPICS:
        assert topic.prototypes, f"topic '{topic.slug}' has no prototypes"
        assert len(topic.prototypes) >= 3, (
            f"topic '{topic.slug}' has only {len(topic.prototypes)} prototypes; "
            f"several angles are needed to cover the topic's region of embedding space"
        )


def test_frontend_taxonomy_matches_backend():
    """
    The frontend keeps its own CATEGORY_MAP for display names. It must list
    exactly the same slugs — a mismatch silently produces topic pages that
    return nothing, or topics the reader can never navigate to.
    """
    types_ts = Path(__file__).resolve().parents[3] / "frontend" / "lib" / "types.ts"
    if not types_ts.exists():
        pytest.skip("frontend not present in this checkout")

    source = types_ts.read_text(encoding="utf-8")
    block = re.search(
        r"export const CATEGORY_MAP:[^=]*=\s*\{(.*?)\n\};", source, re.S
    )
    assert block, "could not locate CATEGORY_MAP in frontend/lib/types.ts"

    frontend_slugs = set(re.findall(r"^\s*(\w+):\s*\{", block.group(1), re.M))
    backend_slugs = set(TOPICS_BY_SLUG)

    assert frontend_slugs == backend_slugs, (
        f"taxonomy drift — only in frontend: {frontend_slugs - backend_slugs}; "
        f"only in backend: {backend_slugs - frontend_slugs}"
    )
