"""
Deliberate cache invalidation for story content.

This replaces the old `core/signals.py`, which was broken in three ways:

  1. It was never loaded at all — `CoreConfig.ready()` was a bare `pass`, so
     neither handler ever ran.
  2. `post_save` on Story fires on *every* write, including the velocity
     recompute that touches hundreds of rows every 5 minutes. Each one issued a
     blocking outbound HTTP request to Next.js.
  3. Those requests ran inside the clustering transaction, so a slow or
     unreachable frontend stalled ingestion.

Invalidation is a deliberate act, not a side effect of any write, so it is
called explicitly from the two places where user-visible content actually
changes: a new article joining a cluster, and synthesis completing.
"""
import logging

from django.conf import settings
from django.core.cache import cache
from django.db import transaction

logger = logging.getLogger(__name__)


# Redis list the ticker reads from. A capped list rather than pub/sub so a
# client connecting a moment after a promotion still sees it — pub/sub delivers
# only to listeners already attached, which for a ticker means every reader who
# loaded the page a second too late sees nothing.
TICKER_KEY = "ticker:recent"
TICKER_MAX = 30


def story_cache_key(slug: str) -> str:
    return f"story:{slug}"


def publish_promotion(story) -> None:
    """
    Record a story reaching a corroborated tier, for the breaking-news ticker.

    The ticker previously polled Postgres every 5 seconds per open connection —
    100 readers meant 20 queries/second that returned nothing 99% of the time,
    and delivery was up to 5 seconds late. Clustering already knows the moment a
    story is promoted, so it writes here and the ticker reads a single Redis key.
    """
    import json

    try:
        payload = json.dumps({
            "id": story.pk,
            "title": story.title,
            "slug": story.slug,
            "status": story.status,
            "independent_count": story.independent_count,
            "first_seen_at": story.first_seen_at.isoformat(),
        })
        client = cache.client.get_client(write=True)
        client.lpush(TICKER_KEY, payload)
        client.ltrim(TICKER_KEY, 0, TICKER_MAX - 1)
    except Exception as e:
        # The ticker is decoration; never let it break clustering.
        logger.debug("Could not publish promotion for %s: %s", story.slug, e)


def invalidate_story(slug: str) -> None:
    """
    Drop the API response cache for a story and ask Next.js to revalidate its page.

    Safe to call inside a transaction — the outbound webhook is deferred until
    commit and dispatched to Celery, so it never blocks the caller.
    """
    if not slug:
        return

    cache.delete(story_cache_key(slug))

    # Feed counts are derived from story rows. delete_pattern is a django-redis
    # extension, so fall back silently on other backends (e.g. locmem in tests).
    delete_pattern = getattr(cache, "delete_pattern", None)
    if delete_pattern is not None:
        try:
            delete_pattern("stories_count:*")
        except Exception as e:
            logger.debug("Could not purge story count keys: %s", e)

    transaction.on_commit(lambda: _queue_frontend_revalidation(slug))


def _queue_frontend_revalidation(slug: str) -> None:
    """
    Ask a worker to purge the story's Next.js page.

    This was the expensive one. Clustering invalidates every story it touches,
    so on a worker-less deployment each article paid twenty Celery reconnect
    attempts — one second apart — to queue a purge nothing would run. It was the
    single largest cost in the pipeline and it bought nothing.
    """
    from core.dispatch import dispatch
    from core.tasks import revalidate_frontend_story

    dispatch(
        revalidate_frontend_story, slug,
        description=f"frontend revalidation for {slug}",
    )


def revalidate_frontend(slug: str) -> bool:
    """
    Call the Next.js on-demand revalidation route. Runs inside a Celery task.

    Returns True when the frontend acknowledged the purge.
    """
    secret = getattr(settings, "REVALIDATE_SECRET", "")
    base_url = getattr(settings, "NEXTJS_URL", "")

    if not secret or not base_url:
        logger.debug("Frontend revalidation not configured; skipping for %s", slug)
        return False

    import requests

    try:
        response = requests.post(
            f"{base_url.rstrip('/')}/api/revalidate",
            json={"tag": f"story:{slug}"},
            headers={"X-Revalidate-Secret": secret},
            timeout=5,
        )
        response.raise_for_status()
        return True
    except requests.RequestException as e:
        logger.warning("Frontend revalidation failed for %s: %s", slug, e)
        return False
