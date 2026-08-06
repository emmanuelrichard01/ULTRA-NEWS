"""
Outbound RSS — one feed per edition.

The sources page advertised /api/v1/feeds/{wire,developing,reporting}.xml. None
of them existed; all three returned 404. Building them is the right resolution
rather than deleting the claim: a news aggregator that can't be subscribed to is
missing an obvious affordance, and readers of this product in particular are the
sort who already live in a feed reader.

Each feed mirrors an edition (see frontend/lib/editions.ts) so what a subscriber
receives matches what the site shows. Every item states its corroboration level,
because that is the entire point of the product and a headline alone drops it.
"""
from django.conf import settings
from django.contrib.syndication.views import Feed
from django.utils.feedgenerator import Rss201rev2Feed

from core.models import Source, Story

# Enough to be useful in a reader without shipping the archive on every poll.
FEED_ITEM_LIMIT = 50


def _site_url() -> str:
    """
    Public origin for feed links.

    Deliberately SITE_URL, not NEXTJS_URL — the latter is the internal compose
    service name used for cache-purge webhooks, and building public feed items
    from it published links to http://frontend:3000.
    """
    return (getattr(settings, "SITE_URL", "") or "http://localhost:3000").rstrip("/")


def _corroboration_sentence(story: Story) -> str:
    n = story.independent_count
    if n >= 3:
        return f"Corroborated by {n} independent outlets."
    if n == 2:
        return "Reported by 2 independent outlets."
    return "Single source — not independently confirmed."


class BaseStoryFeed(Feed):
    """Shared rendering. Subclasses supply the queryset and the descriptions."""

    feed_type = Rss201rev2Feed
    language = "en"

    def link(self):
        return _site_url()

    def _base_queryset(self):
        return Story.objects.filter(
            articles__source__trust_tier=Source.TrustTier.AUTO_PUBLISH
        ).distinct()

    def item_title(self, item: Story) -> str:
        return item.title

    def item_description(self, item: Story) -> str:
        # Corroboration leads. A subscriber scanning titles in a reader should
        # not have to open the item to learn how well-supported it is.
        parts = [_corroboration_sentence(item)]
        if item.summary:
            parts.append(item.summary)
        return " ".join(parts)

    def item_link(self, item: Story) -> str:
        return f"{_site_url()}/story/{item.slug}"

    def item_guid(self, item: Story) -> str:
        # Stable across re-clustering so readers don't re-surface the same story.
        return f"ultra-news:story:{item.pk}"

    def item_guid_is_permalink(self, item: Story) -> bool:
        return False

    def item_pubdate(self, item: Story):
        return item.first_seen_at

    def item_updateddate(self, item: Story):
        return item.last_updated_at

    def item_categories(self, item: Story):
        return [c.slug for c in item.categories.all()]


class WireFeed(BaseStoryFeed):
    title = "Ultra News — The Wire"
    description = (
        "Every story as it lands, with the number of independent outlets "
        "standing behind it."
    )

    def items(self):
        return (
            self._base_queryset()
            .prefetch_related("categories")
            .order_by("-first_seen_at", "-id")[:FEED_ITEM_LIMIT]
        )


class DevelopingFeed(BaseStoryFeed):
    title = "Ultra News — Developing"
    description = (
        "Stories picking up independent coverage now: at least two outlets, "
        "newest first."
    )

    def items(self):
        return (
            self._base_queryset()
            .filter(independent_count__gte=2)
            .prefetch_related("categories")
            .order_by("-first_seen_at", "-id")[:FEED_ITEM_LIMIT]
        )


class RecordFeed(BaseStoryFeed):
    title = "Ultra News — The Record"
    description = (
        "Independently corroborated reporting: three or more outlets, ordered "
        "by weight of evidence."
    )

    def items(self):
        return (
            self._base_queryset()
            .filter(independent_count__gte=3)
            .prefetch_related("categories")
            .order_by("-independent_count", "-first_seen_at", "-id")[:FEED_ITEM_LIMIT]
        )
