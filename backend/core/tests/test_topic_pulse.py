"""The per-topic pulse behind topic pages."""
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone

from core.models import Category, Story
from core.services.topic_pulse import topic_pulse


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _story(slug, topics, outlets=1, hours_ago=2):
    story = Story.objects.create(
        title=f"Story {slug}", slug=slug, summary="",
        first_seen_at=timezone.now() - timedelta(hours=hours_ago),
        independent_count=outlets, source_count=outlets,
    )
    cats = [Category.objects.get_or_create(slug=t, defaults={"name": t.title()})[0] for t in topics]
    story.categories.set(cats)
    return story


@pytest.mark.django_db
def test_today_confirmed_and_leading():
    _story("a", ["climate"], outlets=4)
    _story("b", ["climate"], outlets=1)
    _story("c", ["climate"], outlets=2, hours_ago=30)  # yesterday: not today

    pulse = topic_pulse()["topics"]["climate"]
    assert pulse["today"] == 2
    assert pulse["confirmed_today"] == 1
    assert pulse["leading"]["slug"] == "a"
    assert len(pulse["days"]) == 7
    assert sum(pulse["days"]) == 3


@pytest.mark.django_db
def test_change_against_the_beats_own_norm():
    for i in range(6):
        _story(f"old{i}", ["sports"], hours_ago=30 + 24 * i)  # one a day
    for i in range(2):
        _story(f"new{i}", ["sports"])
    pulse = topic_pulse()["topics"]["sports"]
    assert pulse["daily_average"] == 1.0
    assert pulse["change"] == 1.0  # twice its usual


@pytest.mark.django_db
def test_related_beats_come_from_shared_stories():
    _story("x", ["climate", "business"])
    _story("y", ["climate", "business"])
    _story("z", ["climate", "world"])
    assert topic_pulse()["topics"]["climate"]["related"][0] == "business"


@pytest.mark.django_db
def test_empty_beat_has_no_change_figure():
    pulse = topic_pulse()["topics"]["health"]
    assert pulse["today"] == 0
    assert pulse["change"] is None
    assert pulse["leading"] is None
