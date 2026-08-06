import logging
import os
import threading

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()

logger = logging.getLogger(__name__)


def _warm_embedding_model() -> None:
    """
    Load the embedding model once, at process start.

    Measured cold-load cost is ~11.5s; a warm embed is ~34ms. Loading it lazily
    on first use meant whoever asked the first question after a deploy paid the
    whole 11.5s — including on a semantic cache HIT, because the query still has
    to be embedded before the cache can be consulted. That made a 0.2s cache hit
    present as a 12s wait.

    Runs on a daemon thread so it never delays the server accepting
    connections, and failures are logged rather than raised: the app degrades to
    extractive answers without embeddings, and refusing to boot over it would be
    a worse outcome.
    """
    def _load():
        try:
            from core.clustering import get_embedding_model

            if get_embedding_model() is not None:
                logger.info("Embedding model warmed and ready.")
        except Exception:
            logger.exception("Embedding model warmup failed; will load on first use")

    threading.Thread(target=_load, name="embedding-warmup", daemon=True).start()


# Only the server warms the model. Management commands import settings too, and
# paying 11.5s on every `migrate` or `shell` would be intolerable.
_warm_embedding_model()
