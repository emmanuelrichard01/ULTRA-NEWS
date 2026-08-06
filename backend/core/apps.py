from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    # No signal wiring here by design. Cache invalidation and primary-source
    # recomputation are invoked explicitly from the clustering and synthesis
    # paths (see core/invalidation.py) rather than riding on post_save, which
    # fired on every write — including bulk velocity updates — and issued a
    # blocking outbound HTTP request each time.
