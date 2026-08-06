"""
Server-sent events for the breaking-news ticker.

Two things were wrong with the original implementation:

  1. It could never emit anything. It advanced a cursor over Story *id* and then
     filtered to developing/corroborated. But every story is created as WIRE and
     promoted later, without its id changing — so by the time a story qualified,
     the cursor had long passed it. The ticker was permanently empty.

  2. It was a denial-of-service vector. A synchronous `while True` generator with
     `time.sleep(5)` occupies an ASGI threadpool thread for the entire life of the
     connection, with no disconnect detection, no lifetime bound and no
     connection cap. A few dozen open tabs exhausted the server.

  3. It polled Postgres every 5 seconds PER OPEN CONNECTION. A hundred readers
     meant 20 queries a second that returned nothing almost every time.

This version reads promotions from a capped Redis list that clustering writes to
the moment a story leaves Wire, runs natively async so an idle connection costs a
coroutine instead of a thread, and bounds both its own lifetime and the number of
concurrent streams.
"""
import asyncio
import contextlib
import json
import logging

from django.core.cache import cache
from django.http import StreamingHttpResponse
from django.utils import timezone

from core.invalidation import TICKER_KEY

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 5
# Close and let EventSource reconnect rather than holding a connection forever.
MAX_STREAM_SECONDS = 300
MAX_ITEMS_PER_POLL = 10

# Ceiling on simultaneous streams per process.
MAX_CONCURRENT_STREAMS = 100
_ACTIVE_STREAMS_KEY = "sse:active_streams"


def _read_ticker() -> list[dict]:
    """
    Read recent promotions from Redis.

    Clustering writes here the moment a story leaves Wire (see
    core/invalidation.publish_promotion), so the ticker never touches Postgres.
    The previous implementation ran a database query every 5 seconds *per open
    connection* — 100 readers meant 20 queries/second that returned nothing
    almost every time, and a promotion could still take 5 seconds to appear.
    """
    try:
        client = cache.client.get_client(write=False)
        raw = client.lrange(TICKER_KEY, 0, MAX_ITEMS_PER_POLL - 1)
    except Exception:
        logger.debug("Ticker unavailable", exc_info=True)
        return []

    items = []
    for entry in raw:
        try:
            items.append(json.loads(entry))
        except (ValueError, TypeError):
            continue
    return items


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


async def _event_stream():
    started = timezone.now()

    yield _sse("connected", {"status": "listening"})

    # Track what this connection has already sent, so a reader who connects
    # mid-stream gets the backlog once and then only genuinely new promotions.
    sent_ids: set[int] = set()

    try:
        while (timezone.now() - started).total_seconds() < MAX_STREAM_SECONDS:
            try:
                # A Redis list read, not a database query. Cheap enough that the
                # poll interval is about delivery latency rather than load.
                for item in reversed(_read_ticker()):
                    story_id = item.get("id")
                    if story_id in sent_ids:
                        continue
                    sent_ids.add(story_id)
                    yield _sse("new_story", item)
            except Exception:
                logger.exception("Ticker read failed")
                yield _sse("error", {"error": "unavailable"})

            yield _sse("ping", {"ts": timezone.now().isoformat()})
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

        # Tell the client this is a normal rotation, not a failure.
        yield _sse("reconnect", {"reason": "max_lifetime"})
    except asyncio.CancelledError:
        # Client went away — let the coroutine unwind.
        raise
    finally:
        with contextlib.suppress(ValueError):
            cache.decr(_ACTIVE_STREAMS_KEY)


async def _rejected(reason: str):
    yield _sse("error", {"error": reason})


def breaking_news_stream(request):
    """SSE endpoint for the breaking news ticker."""
    try:
        active = cache.incr(_ACTIVE_STREAMS_KEY)
    except ValueError:
        # Counter not initialised yet.
        cache.set(_ACTIVE_STREAMS_KEY, 1, timeout=None)
        active = 1

    if active > MAX_CONCURRENT_STREAMS:
        with contextlib.suppress(ValueError):
            cache.decr(_ACTIVE_STREAMS_KEY)
        response = StreamingHttpResponse(
            _rejected("capacity"), content_type="text/event-stream", status=503
        )
    else:
        response = StreamingHttpResponse(
            _event_stream(), content_type="text/event-stream"
        )

    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # For Nginx
    # CORS is handled by corsheaders against the configured allowlist. The old
    # hardcoded 'Access-Control-Allow-Origin: *' bypassed that allowlist entirely.
    return response
