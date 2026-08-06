"""
Request correlation and HTTP metrics.

structlog was configured but nothing bound context to it, so every log line
stood alone: given a slow or failing request there was no way to find the other
lines belonging to it. This binds a request id for the life of the request and
clears it afterwards, so JSON logs can be grouped by `request_id` in whatever
aggregator an operator runs.
"""
import logging
import time
import uuid

import structlog

from core.observability import http_duration, http_requests

logger = logging.getLogger(__name__)

# Header an upstream proxy may already have set. Reusing it means the id spans
# the proxy, the app and the frontend rather than starting over at our door.
REQUEST_ID_HEADER = "HTTP_X_REQUEST_ID"


def _endpoint_label(request) -> str:
    """
    A LOW-CARDINALITY label for the URL.

    The resolved route pattern, never the raw path: `/story/<slug>` would
    otherwise mint a new Prometheus time series per story and eventually take
    the metrics endpoint down on its own.
    """
    match = getattr(request, "resolver_match", None)
    if match and match.route:
        return f"/{match.route.rstrip('/')}" if not match.route.startswith("/") else match.route
    return "<unmatched>"


class RequestContextMiddleware:
    """Bind a request id to the log context and record HTTP metrics."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get(REQUEST_ID_HEADER) or uuid.uuid4().hex[:12]
        request.request_id = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.path,
        )

        started = time.perf_counter()
        try:
            response = self.get_response(request)
        except Exception:
            # Metrics for the failure path too — otherwise a 500 storm is
            # invisible in the request counters and only shows up in logs.
            http_requests.labels(_endpoint_label(request), request.method, "5xx").inc()
            http_duration.labels(_endpoint_label(request)).observe(
                time.perf_counter() - started
            )
            raise
        finally:
            structlog.contextvars.clear_contextvars()

        elapsed = time.perf_counter() - started
        endpoint = _endpoint_label(request)

        # Status CLASS, not the exact code — same cardinality reasoning.
        http_requests.labels(
            endpoint, request.method, f"{response.status_code // 100}xx"
        ).inc()
        http_duration.labels(endpoint).observe(elapsed)

        # Lets a reader correlate a slow page with a server-side log line.
        response["X-Request-ID"] = request_id
        return response
