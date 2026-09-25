"""
Video badges: detecting which articles carry publisher video.

Ultra News never plays or re-hosts video; it records that an article has one so
a story can say which outlets have video and link to each publisher's player.
"""
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from ninja.testing import TestClient

from core.models import Article, Source, Story
from core.services.scraper import RSSScraper, extract_video, looks_like_video_page

BASE = "https://news.example.com/2026/09/story"


def page(head: str = "", body: str = "") -> str:
    return f"<html><head>{head}</head><body>{body}</body></html>"


@pytest.mark.parametrize(
    "html, expected",
    [
        (page('<meta property="og:video:secure_url" content="https://cdn.example.com/a.mp4">'), "https://cdn.example.com/a.mp4"),
        (page('<meta property="og:video" content="/clips/b.mp4">'), "https://news.example.com/clips/b.mp4"),
        (page('<meta property="og:type" content="video.other">'), BASE),
        (page('<meta name="twitter:card" content="player"><meta name="twitter:player" content="https://p.example.com/e/1">'), "https://p.example.com/e/1"),
        (page(body='<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>'), "https://www.youtube-nocookie.com/embed/abc123"),
        (page(body='<video><source src="/media/c.mp4" type="video/mp4"></video>'), "https://news.example.com/media/c.mp4"),
    ],
)
def test_video_is_found_however_the_publisher_declares_it(html, expected):
    assert extract_video(html, BASE) == expected


def test_a_page_without_video_reports_none():
    html = page('<meta property="og:type" content="article">', '<iframe src="https://maps.example.com/embed"></iframe>')
    assert extract_video(html, BASE) is None


@pytest.mark.parametrize(
    "url, expected",
    [
        ("https://www.nbcnews.com/video/cuban-delegation-walks-out-123", True),
        ("https://www.bbc.co.uk/news/videos/c0abc", True),
        ("https://www.aljazeera.com/program/newsfeed/2026/9/25/watch-this", False),
        ("https://www.reuters.com/world/some-story-2026-09-25/", False),
    ],
)
def test_video_pages_are_recognised_by_their_path(url, expected):
    assert looks_like_video_page(url) is expected


class _Entry(dict):
    """feedparser entries answer both .get() and attribute access."""

    def __getattr__(self, name):
        return self[name]


def test_a_feed_video_is_not_mistaken_for_the_articles_image():
    """
    `media_content[0]` used to be taken as the image whatever it was, so a
    feed listing its clip first set an .mp4 as the card image.
    """
    entry = _Entry(
        media_content=[
            {"url": "https://cdn.example.com/clip.mp4", "type": "video/mp4"},
            {"url": "https://cdn.example.com/still.jpg", "type": "image/jpeg"},
        ],
        links=[],
    )
    assert RSSScraper._entry_image(entry) == "https://cdn.example.com/still.jpg"
    assert RSSScraper._entry_video(entry) == "https://cdn.example.com/clip.mp4"


@pytest.mark.django_db
def test_story_cards_count_video_by_publisher_not_by_feed():
    cache.clear()
    now = timezone.now()
    story = Story.objects.create(
        title="Video story", slug="video-story", summary="s",
        first_seen_at=now - timedelta(hours=1), independent_count=2, source_count=3,
    )
    feeds = [
        ("BBC News", "https://feeds.bbci.co.uk/news/rss.xml", "https://cdn.bbc/a.mp4"),
        ("BBC World", "https://feeds.bbci.co.uk/world/rss.xml", "https://cdn.bbc/b.mp4"),
        ("NPR", "https://feeds.npr.org/1001/rss.xml", None),
    ]
    for i, (name, url, video) in enumerate(feeds):
        source = Source.objects.create(name=name, url=url, trust_tier=Source.TrustTier.AUTO_PUBLISH)
        Article.objects.create(
            source=source, story=story, title=f"{name} report", url=f"https://example.com/{i}",
            published_date=now, video_url=video,
        )

    from api.api import api

    items = TestClient(api).get("/stories?limit=5").json()["items"]
    card = next(item for item in items if item["slug"] == "video-story")

    # Two BBC feeds are one publisher with video; NPR has none.
    assert card["video_outlets"] == 1
