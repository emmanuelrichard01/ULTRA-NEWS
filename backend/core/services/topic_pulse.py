"""
The pulse of each beat: is it busy today, how much of it is confirmed, and
which beats it runs into.

A topic page used to be the Wire filtered to one category, with nothing to say
about the category itself. This is the "how is this beat doing" layer, in the
product's own terms:

  today        stories first seen in the last 24 hours, against the beat's
               own daily average over the previous six days. "12 today" says
               little; "12 today, twice its usual" says the beat is moving.
  confirmed    how many of today's stories two or more newsrooms have
               independently reported. A beat running mostly single-source
               reads very differently from one that is mostly confirmed.
  days         seven daily counts, oldest first, for a sparkline.
  leading      today's most corroborated story in the beat.
  related      beats that share stories with this one this week, by count.
               Stories carry at most two topics, so a pairing is a real
               overlap, not noise ("Climate runs into Business").

One aggregate query per signal, cached for ten minutes — the pulse changes at
the speed of the pipeline, not of page views.
"""
from collections import Counter, defaultdict
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from core.models import Story
from core.topics import TOPICS

CACHE_KEY = "topic_pulse:v1"
CACHE_SECONDS = 600
DAYS = 7


def topic_pulse() -> dict:
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return cached

    now = timezone.now()
    today_start = now - timedelta(hours=24)
    week_start = now - timedelta(days=DAYS)

    # Daily counts per topic, by the day each story was first seen.
    daily = (
        Story.objects.filter(first_seen_at__gte=week_start, categories__isnull=False)
        .annotate(day=TruncDate("first_seen_at"))
        .values("categories__slug", "day")
        .annotate(n=Count("id", distinct=True))
    )
    days = [(now - timedelta(days=DAYS - 1 - i)).date() for i in range(DAYS)]
    series: dict[str, dict] = defaultdict(dict)
    for row in daily:
        series[row["categories__slug"]][row["day"]] = row["n"]

    # Today (rolling 24h) and how much of it is confirmed.
    recent = (
        Story.objects.filter(first_seen_at__gte=today_start, categories__isnull=False)
        .values("categories__slug")
        .annotate(
            n=Count("id", distinct=True),
            confirmed=Count("id", filter=Q(independent_count__gte=2), distinct=True),
        )
    )
    today = {row["categories__slug"]: row for row in recent}

    # Previous six days, for the baseline.
    prior = (
        Story.objects.filter(
            first_seen_at__gte=week_start, first_seen_at__lt=today_start, categories__isnull=False,
        )
        .values("categories__slug")
        .annotate(n=Count("id", distinct=True))
    )
    baseline = {row["categories__slug"]: row["n"] / (DAYS - 1) for row in prior}

    # Leading story per topic: today's most corroborated, then freshest.
    leading: dict[str, dict] = {}
    candidates = (
        Story.objects.filter(first_seen_at__gte=today_start, categories__isnull=False)
        .order_by("-independent_count", "-last_updated_at")
        .values("categories__slug", "slug", "title", "independent_count")[:400]
    )
    for row in candidates:
        leading.setdefault(row["categories__slug"], {
            "slug": row["slug"],
            "title": row["title"],
            "independent_count": row["independent_count"],
        })

    # Co-occurrence this week.
    topics_by_story: dict[int, set] = defaultdict(set)
    for story_id, slug in Story.objects.filter(
        first_seen_at__gte=week_start, categories__isnull=False,
    ).values_list("id", "categories__slug"):
        topics_by_story[story_id].add(slug)
    pairs: dict[str, Counter] = defaultdict(Counter)
    for slugs in topics_by_story.values():
        for a in slugs:
            for b in slugs:
                if a != b:
                    pairs[a][b] += 1

    result = {"generated_at": now.isoformat(), "topics": {}}
    for topic in TOPICS:
        slug = topic.slug
        count = today.get(slug, {}).get("n", 0)
        avg = baseline.get(slug, 0.0)
        result["topics"][slug] = {
            "today": count,
            "confirmed_today": today.get(slug, {}).get("confirmed", 0),
            "daily_average": round(avg, 1),
            # vs its own norm; None when there is no norm to compare against.
            "change": round(count / avg - 1, 2) if avg >= 1 else None,
            "days": [series[slug].get(day, 0) for day in days],
            "leading": leading.get(slug),
            "related": [other for other, _n in pairs[slug].most_common(3)],
        }

    cache.set(CACHE_KEY, result, CACHE_SECONDS)
    return result
