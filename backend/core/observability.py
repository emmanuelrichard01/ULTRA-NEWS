"""
Metrics.

Instrumented around the questions you actually need answered at 3am, rather
than around whatever is easy to count:

  Is ingestion working?      per-source outcomes, articles saved, feed latency
  Is clustering keeping up?  the pending backlog — the single best health signal
                             in this system, because an article that is never
                             clustered is invisible to every reader, and nothing
                             else surfaces that
  Is the AI costing money?   calls, fallbacks, cache hits, and what was skipped
                             by the daily budget ceiling
  Are requests slow?         latency and status by endpoint

`prometheus_client` directly rather than django-prometheus: that package works
by swapping the DATABASES engine and CACHES backend for its own wrappers, which
is a lot of surface area to inherit for request counters we can define
explicitly. This module is also a no-op when the library is absent, so the
dependency stays genuinely optional for anyone self-hosting.
"""
import logging
from contextlib import contextmanager
from time import perf_counter

logger = logging.getLogger(__name__)

try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
    )

    METRICS_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only in trimmed installs
    METRICS_AVAILABLE = False
    CONTENT_TYPE_LATEST = "text/plain"


class _NoopMetric:
    """Stand-in so call sites never need to guard on METRICS_AVAILABLE."""

    def labels(self, *args, **kwargs):
        return self

    def inc(self, *args, **kwargs):
        pass

    def observe(self, *args, **kwargs):
        pass

    def set(self, *args, **kwargs):
        pass


def _counter(name, doc, labels=()):
    return Counter(name, doc, labels) if METRICS_AVAILABLE else _NoopMetric()


def _histogram(name, doc, labels=(), buckets=None):
    if not METRICS_AVAILABLE:
        return _NoopMetric()
    kwargs = {"buckets": buckets} if buckets else {}
    return Histogram(name, doc, labels, **kwargs)


def _gauge(name, doc, labels=()):
    return Gauge(name, doc, labels) if METRICS_AVAILABLE else _NoopMetric()


# ==========================================================================
# HTTP
# ==========================================================================

http_requests = _counter(
    "ultranews_http_requests_total",
    "HTTP requests by endpoint and status class.",
    ("endpoint", "method", "status"),
)

http_duration = _histogram(
    "ultranews_http_request_seconds",
    "HTTP request duration by endpoint.",
    ("endpoint",),
    # Tuned to this app's actual range: feed pages sit near 80ms, /ask runs to
    # ~15s. Default buckets top out at 10s and would put every LLM call in +Inf.
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 20.0, 30.0),
)

# ==========================================================================
# Ingestion
# ==========================================================================

ingest_outcomes = _counter(
    "ultranews_ingest_outcomes_total",
    "Feed fetch outcomes. `not_modified` is a success — the publisher confirmed "
    "nothing changed and sent no body.",
    ("outcome",),  # success | not_modified | failure
)

articles_ingested = _counter(
    "ultranews_articles_ingested_total",
    "Articles persisted by ingestion.",
)

feed_fetch_duration = _histogram(
    "ultranews_feed_fetch_seconds",
    "Time to fetch and parse one feed.",
    buckets=(0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

sources_failing = _gauge(
    "ultranews_sources_failing",
    "Active sources with at least one consecutive failure.",
)

sources_active = _gauge(
    "ultranews_sources_active",
    "Sources currently enabled for ingestion.",
)

# ==========================================================================
# Clustering
# ==========================================================================

# The most important gauge in the system. Articles are invisible to readers
# until clustered, so a rising backlog means the product is silently going stale
# even though every request still returns 200.
articles_pending_clustering = _gauge(
    "ultranews_articles_pending_clustering",
    "Articles ingested but not yet assigned to a story.",
)

clustering_duration = _histogram(
    "ultranews_clustering_article_seconds",
    "Time to cluster one article.",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5),
)

clustering_outcomes = _counter(
    "ultranews_clustering_outcomes_total",
    "Whether an article joined an existing story or created a new one.",
    ("outcome",),  # matched | created | failed
)

stories_promoted = _counter(
    "ultranews_stories_promoted_total",
    "Stories crossing a corroboration tier.",
    ("tier",),
)

# ==========================================================================
# AI
# ==========================================================================

llm_calls = _counter(
    "ultranews_llm_calls_total",
    "Model calls by purpose and outcome.",
    ("purpose", "outcome"),  # ask|synthesis x success|fallback|failure
)

llm_duration = _histogram(
    "ultranews_llm_call_seconds",
    "Model call duration.",
    ("purpose",),
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 20.0, 45.0),
)

answer_cache_events = _counter(
    "ultranews_answer_cache_total",
    "Semantic answer cache hits and misses — the main lever on inference spend.",
    ("result",),  # hit | miss
)

budget_rejections = _counter(
    "ultranews_budget_rejections_total",
    "Requests refused by a daily spend ceiling.",
    ("kind",),
)


@contextmanager
def observe(histogram, *labels):
    """Time a block into a histogram, recording even when it raises."""
    started = perf_counter()
    try:
        yield
    finally:
        elapsed = perf_counter() - started
        (histogram.labels(*labels) if labels else histogram).observe(elapsed)


def refresh_domain_gauges() -> None:
    """
    Recompute point-in-time gauges.

    Called when /metrics is scraped rather than on a timer: gauges that describe
    current state are only meaningful at read time, and this keeps the queries
    off the ingest path.
    """
    if not METRICS_AVAILABLE:
        return

    try:
        from core.models import Article, Source

        articles_pending_clustering.set(
            Article.objects.filter(story__isnull=True).count()
        )
        active = Source.objects.filter(is_active=True)
        sources_active.set(active.count())
        sources_failing.set(active.filter(consecutive_failures__gt=0).count())
    except Exception:
        # Never let instrumentation take down the endpoint that reports health.
        logger.exception("Failed to refresh domain gauges")


def render_metrics() -> tuple[bytes, str]:
    """
    Render the Prometheus exposition payload.

    Multi-process aware. prometheus_client keeps counters in process memory, so
    under `gunicorn --workers N` a scrape would otherwise return whichever
    worker happened to serve it — counters that jump around at random and are
    worse than no metrics at all, because they look plausible.
    """
    if not METRICS_AVAILABLE:
        return (
            b"# prometheus_client is not installed; metrics are disabled.\n",
            CONTENT_TYPE_LATEST,
        )

    refresh_domain_gauges()

    import os

    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        # Aggregate the per-process files gunicorn workers write into.
        from prometheus_client import multiprocess

        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return generate_latest(registry), CONTENT_TYPE_LATEST

    return generate_latest(), CONTENT_TYPE_LATEST
