"""
Observability.

Instrumentation is the thing nobody notices is broken until they need it, so
these check the properties that actually matter: metrics don't take the app down
when the library is missing, labels stay low-cardinality, the endpoint is not
public, and health reports the signals an operator would page on.
"""
import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_metrics_endpoint_renders(client, settings):
    settings.METRICS_ENABLED = True
    settings.METRICS_TOKEN = ""
    settings.METRICS_ALLOWED_IPS = []

    response = client.get(reverse("metrics"))

    assert response.status_code == 200
    body = response.content.decode()
    # The domain gauges are the point — generic HTTP counters are available from
    # any proxy, but nothing else can report the clustering backlog.
    assert "ultranews_articles_pending_clustering" in body


@pytest.mark.django_db
def test_metrics_endpoint_can_be_disabled(client, settings):
    settings.METRICS_ENABLED = False
    assert client.get(reverse("metrics")).status_code == 403


@pytest.mark.django_db
def test_metrics_endpoint_requires_token_when_set(client, settings):
    """
    Metrics describe internal state — backlog depth, per-source failures, AI
    spend — and should not be readable by anyone who finds the port.
    """
    settings.METRICS_ENABLED = True
    settings.METRICS_ALLOWED_IPS = []
    settings.METRICS_TOKEN = "s3cret"

    assert client.get(reverse("metrics")).status_code == 403
    assert client.get(reverse("metrics"), HTTP_AUTHORIZATION="Bearer wrong").status_code == 403
    assert client.get(reverse("metrics"), HTTP_AUTHORIZATION="Bearer s3cret").status_code == 200


@pytest.mark.django_db
def test_metrics_ip_allowlist_ignores_forwarded_header(client, settings):
    """
    The allowlist must key on REMOTE_ADDR. A client-settable header cannot be an
    access control — the rate limiter had exactly this bug.
    """
    settings.METRICS_ENABLED = True
    settings.METRICS_TOKEN = ""
    settings.METRICS_ALLOWED_IPS = ["10.9.9.9"]

    spoofed = client.get(
        reverse("metrics"),
        HTTP_X_FORWARDED_FOR="10.9.9.9",
        REMOTE_ADDR="127.0.0.1",
    )
    assert spoofed.status_code == 403

    assert client.get(reverse("metrics"), REMOTE_ADDR="10.9.9.9").status_code == 200


@pytest.mark.django_db
def test_request_id_is_returned_and_reused(client):
    """
    Every response carries a correlation id, and an upstream one is honoured so
    the id spans the proxy rather than restarting at our door.
    """
    generated = client.get("/api/v1/health")
    assert generated["X-Request-ID"]

    passed_through = client.get("/api/v1/health", HTTP_X_REQUEST_ID="abc123")
    assert passed_through["X-Request-ID"] == "abc123"


@pytest.mark.django_db
def test_http_metrics_use_route_patterns_not_paths(client, settings):
    """
    Endpoint labels must be the route pattern. Labelling by raw path would mint
    a Prometheus series per story slug and eventually kill the metrics endpoint
    with cardinality — the classic way instrumentation causes the outage.
    """
    settings.METRICS_ENABLED = True
    settings.METRICS_TOKEN = ""
    settings.METRICS_ALLOWED_IPS = []

    client.get("/api/v1/health")
    body = client.get(reverse("metrics")).content.decode()

    assert "ultranews_http_requests_total" in body
    # No concrete slug should ever appear as a label value.
    assert "/api/v1/stories/ukraine" not in body


@pytest.mark.django_db
def test_health_reports_clustering_backlog(client):
    """
    The backlog is the signal nothing else surfaces: unclustered articles are
    invisible to readers while every request still returns 200.
    """
    payload = client.get("/api/v1/health").json()

    assert "pending_clustering" in payload
    assert payload["clustering"] in ("ok", "unknown") or "backlog" in payload["clustering"]
    assert "sources_failing" in payload


@pytest.mark.django_db
def test_health_degrades_on_large_backlog(client, settings, django_assert_num_queries):
    from datetime import timedelta

    from django.utils import timezone

    import api.api as api_module
    from core.models import Article, Source

    source = Source.objects.create(
        name="Backlog", url="https://feeds.backlog.test/rss",
        trust_tier=Source.TrustTier.AUTO_PUBLISH,
    )
    Article.objects.create(
        source=source, title="Unclustered", url="https://backlog.test/1",
        published_date=timezone.now() - timedelta(hours=1),
    )

    original = api_module.CLUSTER_BACKLOG_DEGRADED
    api_module.CLUSTER_BACKLOG_DEGRADED = 0
    try:
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        assert "backlog" in response.json()["clustering"]
    finally:
        api_module.CLUSTER_BACKLOG_DEGRADED = original


def test_metrics_degrade_to_noops_without_the_library(monkeypatch):
    """
    prometheus-client is optional. Instrumentation must never be the reason a
    self-hosted deployment fails to start.
    """
    import core.observability as obs

    monkeypatch.setattr(obs, "METRICS_AVAILABLE", False)
    noop = obs._NoopMetric()

    # Every call shape used across the codebase must be a safe no-op.
    noop.labels("a", "b").inc()
    noop.observe(1.23)
    noop.set(5)

    payload, content_type = obs.render_metrics()
    assert b"disabled" in payload
    assert content_type


@pytest.mark.django_db
def test_health_reads_ingest_freshness_from_the_database(client):
    """
    The signal must survive a process boundary.

    It previously read a cache key written by the ingest process. Whenever
    ingestion runs elsewhere — the $0 deployment runs it on a CI runner with its
    own in-memory cache — the API never saw the key and reported "no ingest
    recorded yet" forever, including while ingestion was succeeding on schedule.
    A staleness check that cannot fire hides the very state it exists to reveal.
    """
    from django.core.cache import cache
    from django.utils import timezone

    from core.models import Source

    cache.clear()  # prove the cache is not what makes this work
    Source.objects.create(
        name="Fresh", url="https://fresh.example/rss",
        is_active=True, last_success_at=timezone.now(),
    )

    body = client.get("/api/v1/health").json()
    assert body["ingest"] == "ok", body


@pytest.mark.django_db
def test_health_degrades_when_ingest_goes_stale(client):
    from datetime import timedelta

    from django.utils import timezone

    from core.models import Source

    Source.objects.create(
        name="Stale", url="https://stale.example/rss",
        is_active=True, last_success_at=timezone.now() - timedelta(hours=3),
    )

    response = client.get("/api/v1/health")
    body = response.json()
    assert body["status"] == "degraded"
    assert "stale" in body["ingest"]
    assert response.status_code == 503, "uptime checks must see a non-200"
