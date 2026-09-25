"""
Topic evidence: the publisher's filing, the text, and the story's vote.

Semantic similarity alone left 28% of live stories untagged — short headlines
score flat across topics. These tests lock in the three things that fixed it:
editorial hints read from where the publisher filed the piece, evidence that
lets either signal decide a clear case, and story topics decided by a vote
across publishers rather than a union of every article's tags.
"""
import pytest

from core.services.scraper import is_commerce
from core.topics import (
    TOPIC_EVIDENCE_MIN,
    editorial_hints,
    pick_topics,
    story_topics,
    topic_evidence,
)


class TestEditorialHints:
    def test_article_section_is_read_from_the_path(self):
        hints = editorial_hints("https://www.theguardian.com/business/2026/sep/25/fed-holds-rates")
        assert set(hints) == {"business"}

    def test_the_slug_is_prose_not_a_section(self):
        # "sport" inside the final slug is the headline talking, not a filing.
        assert editorial_hints("https://example.com/2026/09/25/why-sport-matters-to-politics") == {}

    def test_whole_segments_only(self):
        assert editorial_hints("https://example.com/passport/2026/story") == {}

    def test_feed_section_includes_the_file_name(self):
        assert "politics" in editorial_hints(feed_url="https://rss.politico.com/politics-news.xml")
        assert "tech" in editorial_hints(feed_url="https://www.bbci.co.uk/news/tech/rss.xml")

    def test_rss_categories(self):
        assert set(editorial_hints(tags=["Sports", "Headlines"])) == {"sports"}

    def test_publisher_beat_is_the_weakest_hint(self):
        beat = editorial_hints(publisher_domain="techcrunch.com")["tech"]
        section = editorial_hints("https://x.com/technology/2026/a-story")["tech"]
        assert beat < section

    def test_hints_add_across_kinds(self):
        both = editorial_hints(
            "https://www.bbc.co.uk/sport/football/articles/abc",
            feed_url="https://feeds.bbci.co.uk/sport/rss.xml",
        )
        one = editorial_hints("https://www.bbc.co.uk/sport/football/articles/abc")
        assert both["sports"] > one["sports"]


class TestPickTopics:
    def test_editorial_section_decides_alone(self):
        assert pick_topics(topic_evidence(None, {"business": 2.0})) == ["business"]

    def test_weak_evidence_decides_nothing(self):
        assert pick_topics({"tech": TOPIC_EVIDENCE_MIN - 0.1}) == []

    def test_second_topic_only_when_nearly_as_strong(self):
        assert pick_topics({"science": 2.0, "climate": 1.5}) == ["science", "climate"]
        assert pick_topics({"science": 2.0, "climate": 1.1}) == ["science"]

    def test_at_most_two(self):
        assert len(pick_topics({"a": 2.0, "b": 2.0, "c": 2.0})) == 2


class TestStoryTopics:
    def test_primary_is_the_consensus(self):
        votes = [
            ("bbc.co.uk", {"sports": 2.5}),
            ("theguardian.com", {"sports": 2.0}),
            ("aljazeera.com", {"world": 1.2}),
        ]
        assert story_topics(votes)[0] == "sports"

    def test_one_off_angle_outlet_does_not_tag_the_story(self):
        # Under the old union, the single culture take tagged the story forever.
        votes = [
            ("a.com", {"climate": 2.0}),
            ("b.com", {"climate": 2.2}),
            ("c.com", {"climate": 1.8}),
            ("d.com", {"culture": 1.2}),
        ]
        assert story_topics(votes) == ["climate"]

    def test_one_vote_per_publisher(self):
        # Six live-blog updates from one newsroom are one vote.
        votes = [("liveblog.com", {"politics": 2.0})] * 6 + [
            ("a.com", {"world": 2.0}),
            ("b.com", {"world": 2.0}),
        ]
        assert story_topics(votes)[0] == "world"

    def test_no_evidence_no_topic(self):
        assert story_topics([]) == []
        assert story_topics([("a.com", {})]) == []


@pytest.fixture(scope="module")
def embed():
    from core.clustering import get_embedding_model

    model = get_embedding_model()
    if model is None:
        pytest.skip("fastembed unavailable")
    return lambda text: [float(x) for x in list(model.embed([text]))[0]]


class TestSemanticEvidence:
    def test_flat_headline_is_rescued_by_the_filing(self, embed):
        text = "Anthropic's founders seek voting control ahead of IPO"
        assert pick_topics(topic_evidence(embed(text))) == []
        hints = editorial_hints("https://www.theverge.com/ai-artificial-intelligence/1/anthropic")
        assert pick_topics(topic_evidence(embed(text), hints))[0] == "tech"

    def test_clear_text_outweighs_a_publisher_beat(self, embed):
        # The Verge is a tech outlet; a clearly sporting story is still sport.
        text = "Manchester United beat Liverpool 3-1 in the Premier League"
        chosen = pick_topics(topic_evidence(embed(text), editorial_hints(publisher_domain="theverge.com")))
        assert chosen[0] == "sports"


class TestCommerce:
    @pytest.mark.parametrize("url,title", [
        ("https://www.wired.com/story/ulta-coupon/", "Ulta Promo Codes: Up to 20% Off in September 2026"),
        ("https://www.wired.com/story/litter-robot-promo-code/", "Litter-Robot Promo Codes: Up to $150 Off"),
        ("https://example.com/coupons/hoka", "Hoka"),
        ("https://example.com/2026/09/deal", "30% off Vistaprint with this promo"),
    ])
    def test_affiliate_pages_are_commerce(self, url, title):
        assert is_commerce(url, title)

    @pytest.mark.parametrize("url,title", [
        ("https://example.com/business/2026/ftc-fake-coupons", "FTC sues retailer over fake coupons"),
        ("https://example.com/tech/qualcomm-chip", "Qualcomm's new sound chip"),
    ])
    def test_reporting_about_commerce_is_not(self, url, title):
        assert not is_commerce(url, title)
