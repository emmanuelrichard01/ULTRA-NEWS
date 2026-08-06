"""
One place to queue a Celery task.

Every `.delay()` in this codebase now goes through `dispatch()`, because doing
it ad hoc cost two separate production incidents with the same root cause.

`.delay()` against an unreachable broker does not fail fast. Celery retries —
by default twenty times, one second apart — and only then raises. Each call site
wrapped that in its own try/except, which made the failure invisible while
leaving the twenty seconds fully intact.

On a deployment with no worker, clustering hit two such sites per story:
synthesis and frontend revalidation. That was ~20 seconds per article of pure
waiting, to queue work nothing existed to consume. It turned a routine pipeline
run into a job that timed out at 25 minutes having processed 70 articles.

Gating the individual sites is not enough, because the bug is that a *new* call
site silently reintroduces the cost. So the gate lives here, and call sites do
not get to choose.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def dispatch_enabled() -> bool:
    """Whether anything exists to consume a queued task."""
    return getattr(settings, "CELERY_DISPATCH_ENABLED", True)


def dispatch(task, *args, description: str = "", **kwargs) -> bool:
    """
    Queue `task`, or skip when no worker can consume it.

    Returns True when the task was handed to the broker. Never raises: a
    background task that cannot be queued must not fail the foreground work
    that scheduled it.
    """
    if not dispatch_enabled():
        return False

    try:
        task.delay(*args, **kwargs)
        return True
    except Exception as e:  # noqa: BLE001 - broker/transport errors are all shapes
        label = description or getattr(task, "name", "task")
        logger.warning("Could not queue %s: %s", label, str(e)[:160])
        return False
