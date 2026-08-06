"""
Prometheus scrape endpoint.

Access-controlled by default. The metrics describe internal state — clustering
backlog, per-source failure counts, AI spend — which is operational detail, not
something to publish alongside a public news feed. An operator whose metrics
port is already private can leave both controls unset.
"""
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden

from core.observability import render_metrics

logger = logging.getLogger(__name__)


def _is_permitted(request) -> bool:
    token = getattr(settings, "METRICS_TOKEN", "")
    if token:
        import secrets

        header = request.META.get("HTTP_AUTHORIZATION", "")
        supplied = header[7:] if header.startswith("Bearer ") else ""
        # Constant-time compare, same reasoning as the admin API key.
        if not supplied or not secrets.compare_digest(supplied, token):
            return False

    allowed = getattr(settings, "METRICS_ALLOWED_IPS", [])
    # REMOTE_ADDR deliberately, never X-Forwarded-For: this is an access
    # control, and a client-settable header cannot be one.
    return not (allowed and request.META.get("REMOTE_ADDR", "") not in allowed)


def metrics_view(request):
    if not getattr(settings, "METRICS_ENABLED", True):
        return HttpResponseForbidden("Metrics are disabled.")

    if not _is_permitted(request):
        logger.warning(
            "Rejected metrics scrape from %s", request.META.get("REMOTE_ADDR", "?")
        )
        return HttpResponseForbidden("Not permitted.")

    payload, content_type = render_metrics()
    return HttpResponse(payload, content_type=content_type)
