"""
Materialised momentum — independent publishers gained inside a rolling window.

Powers the Developing edition. Computing it per request meant a filtered
COUNT(DISTINCT) joined across every article of every story on the page: 326ms
warm, and the cost grew with cluster size, so the best-covered stories were the
most expensive to rank.

The subtlety that makes this more than a cache is **decay**. Momentum falls as
the window slides, with no write to the story at all: an event that drew ten
outlets thirteen hours ago has zero momentum now, but nothing touched its row to
say so. Refreshing only when an article joins would leave yesterday's news
permanently pinned to the top of Developing.

So the refresh has two halves:

  1. Recompute stories that could still be inside the window.
  2. Zero everything that has aged out — one bulk UPDATE, no per-row work.

Both are bounded: the first by the window, the second by an indexed predicate.
"""
import logging
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# Must match api.MOMENTUM_WINDOW_HOURS. Defined here because this module owns
# the computation; the API imports the value rather than restating it.
MOMENTUM_WINDOW_HOURS = 12

# Margin beyond the window when selecting candidates to recompute. A story whose
# newest article just fell out still needs one final pass to be zeroed correctly
# rather than left at its last non-zero value.
REFRESH_MARGIN_HOURS = 2


def _window_start():
    return timezone.now() - timedelta(hours=MOMENTUM_WINDOW_HOURS)


def _publisher_identity():
    """
    SQL expression for a source's publisher identity.

    Mirrors `Source.independence_key`: the resolved domain, falling back to the
    feed URL when it is blank. Without the fallback every unresolvable source
    shares the empty string and `COUNT(DISTINCT …)` treats them as one
    publisher.
    """
    from django.db.models import CharField, Value
    from django.db.models.functions import Coalesce, NullIf

    return Coalesce(
        NullIf('articles__source__publisher_domain', Value('', output_field=CharField())),
        'articles__source__url',
        output_field=CharField(),
    )


def refresh_momentum(story_ids=None) -> dict:
    """
    Recompute `momentum_outlets`.

    With `story_ids`, refreshes exactly those (used by clustering when a story
    changes). Without, refreshes every story that could plausibly be inside the
    window and zeroes the rest.
    """
    from core.models import Source, Story

    window_start = _window_start()
    now = timezone.now()

    if story_ids is not None:
        candidates = Story.objects.filter(pk__in=list(story_ids))
        zeroed = 0
    else:
        # Anything with an article recent enough to count, plus anything
        # currently showing momentum (so it can be re-checked and dropped).
        candidates = Story.objects.filter(
            Q(articles__published_date__gte=window_start) | Q(momentum_outlets__gt=0)
        ).distinct()

        # Stories with no article in the window and no chance of one: zero them
        # in a single UPDATE rather than recomputing each.
        stale_cutoff = now - timedelta(hours=MOMENTUM_WINDOW_HOURS + REFRESH_MARGIN_HOURS)
        zeroed = (
            Story.objects
            .filter(momentum_outlets__gt=0, last_updated_at__lt=stale_cutoff)
            .update(momentum_outlets=0, momentum_computed_at=now)
        )

    scored = candidates.annotate(
        _recent=Count(
            # Falls back to the feed URL when the domain could not be resolved.
            #
            # Counting `publisher_domain` directly collapsed every unresolvable
            # source into ONE publisher, because they all share the empty
            # string — silently understating corroboration and suppressing
            # affected stories from this edition. `Source.independence_key`
            # already had this fallback; the SQL aggregate bypassed it.
            _publisher_identity(),
            filter=Q(
                # published_date, not created_at: created_at is when WE scraped,
                # so on a fresh database every article looks newly arrived and
                # momentum collapses into "total outlets".
                articles__published_date__gte=window_start,
                articles__source__trust_tier=Source.TrustTier.AUTO_PUBLISH,
            ),
            distinct=True,
        )
    ).only('id', 'momentum_outlets')

    updated = []
    for story in scored.iterator(chunk_size=500):
        if story.momentum_outlets != story._recent:
            story.momentum_outlets = story._recent
            story.momentum_computed_at = now
            updated.append(story)

    if updated:
        Story.objects.bulk_update(
            updated, ['momentum_outlets', 'momentum_computed_at'], batch_size=500
        )

    result = {"updated": len(updated), "zeroed": zeroed}
    logger.info("Momentum refresh: %s", result)
    return result
