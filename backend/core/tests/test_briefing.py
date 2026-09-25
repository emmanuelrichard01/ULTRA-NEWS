"""
The Briefing: only corroborated stories, every line cited, keyless still works.
"""
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from django.core.cache import cache
from django.utils import timezone

from core.models import Article, Source, Story
from core.services.briefing import build_briefing, validate_briefing
from core.services.llm import LLMResponse


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _story(slug, outlets, hours_ago=2):
    story = Story.objects.create(
        title=f"Story {slug}", slug=slug, summary=f"Summary of {slug}.",
        first_seen_at=timezone.now() - timedelta(hours=hours_ago),
        independent_count=outlets, source_count=outlets,
    )
    for i in range(outlets):
        source, _ = Source.objects.get_or_create(
            url=f"https://feeds.outlet{i}.com/rss",
            defaults={"name": f"Outlet {i}", "trust_tier": Source.TrustTier.AUTO_PUBLISH},
        )
        Article.objects.create(
            source=source, story=story, title=f"{slug} headline {i}",
            url=f"https://outlet{i}.com/{slug}", published_date=story.first_seen_at,
        )
    return story


@pytest.mark.django_db
def test_single_source_stories_never_reach_the_briefing():
    _story("confirmed-a", 3)
    _story("confirmed-b", 2)
    _story("confirmed-c", 4)
    _story("lonely", 1)

    briefing = build_briefing(provider=None)
    slugs = [item["slug"] for item in briefing["items"]]

    assert "lonely" not in slugs
    # Most corroborated first.
    assert slugs[0] == "confirmed-c"
    assert briefing["synthesis_type"] == "extractive"
    assert "[1]" in briefing["overview"]
    assert all(item["line"] for item in briefing["items"])


@pytest.mark.django_db
def test_model_briefing_is_used_and_dead_citations_are_removed():
    for i in range(3):
        _story(f"s{i}", 3)
    provider = MagicMock()
    provider.generate.return_value = LLMResponse(
        text='{"overview": "Talks resumed [1] and [9].", "lines": [{"n": 2, "line": "Second [2]."}]}',
        model="stub",
    )

    briefing = build_briefing(provider=provider)

    assert briefing["synthesis_type"] == "llm"
    assert "[9]" not in briefing["overview"] and "[1]" in briefing["overview"]
    by_n = {item["n"]: item["line"] for item in briefing["items"]}
    assert by_n[2] == "Second [2]."
    # A story the model skipped keeps its extractive line.
    assert by_n[1] and by_n[3]


@pytest.mark.django_db
def test_briefing_is_cached_for_the_same_story_set():
    for i in range(3):
        _story(f"c{i}", 2)
    provider = MagicMock()
    provider.generate.return_value = LLMResponse(text='{"overview": "x [1]", "lines": []}', model="m")

    build_briefing(provider=provider)
    build_briefing(provider=provider)

    assert provider.generate.call_count == 1


def test_briefing_without_an_overview_is_rejected():
    with pytest.raises(ValueError):
        validate_briefing({"lines": []}, [{"n": 1}])


@pytest.mark.django_db
def test_extractive_lines_drop_repeated_headlines_and_video_playlists():
    a = _story("repeat", 3)
    a.summary = "Story repeat — and here is the actual substance of the report, at length."
    a.save()
    b = _story("video", 2)
    b.summary = "03:18 UP NEXT Something unrelated from a video playlist"
    b.save()
    _story("plain", 2)

    lines = {i["slug"]: i["line"] for i in build_briefing(provider=None)["items"]}

    assert lines["repeat"].startswith("and here is the actual substance")
    assert "UP NEXT" not in lines["video"]
    assert lines["video"].startswith("Carried by 2 independent outlets")
