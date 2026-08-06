import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY: Default to False in production
DEBUG = os.environ.get('DEBUG', '0') == '1'


def _required_secret(name: str, dev_default: str) -> str:
    """
    Read a secret from the environment. Outside DEBUG, refuse to start without it.

    These used to fall back to hardcoded values unconditionally, so a production
    deploy that forgot an environment variable would come up healthy while signing
    sessions and CSRF tokens with a key published in this repository.
    """
    value = os.environ.get(name, '')
    if value:
        return value
    if DEBUG:
        return dev_default
    raise ImproperlyConfigured(
        f"{name} must be set when DEBUG is disabled. Refusing to start with a "
        f"default value."
    )


SECRET_KEY = _required_secret('SECRET_KEY', 'django-insecure-dev-only-key')

# SECURITY: Explicit allowed hosts (no wildcards in production)
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]

# Admin API Key for protected endpoints
ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', '')

# ==========================================================================
# Trusted proxy configuration
# ==========================================================================
# Whether X-Forwarded-For may be believed when identifying a client IP.
# Enable ONLY when every request reaches the app through a proxy that
# overwrites this header. Left off, the rate limiter uses REMOTE_ADDR, which a
# client cannot forge.
TRUST_PROXY_HEADERS = os.environ.get('TRUST_PROXY_HEADERS', '0') == '1'

# How many proxies sit in front of the app. The client IP is read this many
# entries from the right of X-Forwarded-For, so hops the client prepends are
# ignored.
TRUSTED_PROXY_COUNT = int(os.environ.get('TRUSTED_PROXY_COUNT', '1'))

# GitHub repository ("owner/name") permitted to invoke OIDC-authenticated
# admin endpoints. Required in production — without it, any GitHub Actions
# workflow anywhere could authenticate.
GITHUB_OIDC_REPOSITORY = os.environ.get('GITHUB_OIDC_REPOSITORY', '')

# ==========================================================================
# Frontend integration
# ==========================================================================
# Internal origin for the cache-purge webhook. Inside compose this is a service
# name and is NOT reachable from outside.
NEXTJS_URL = os.environ.get('NEXTJS_URL', '')
REVALIDATE_SECRET = os.environ.get('REVALIDATE_SECRET', '')

# Public origin, used to build absolute links in outbound RSS. Kept separate
# from NEXTJS_URL because that one resolves only on the container network —
# using it here published feed items linking to http://frontend:3000.
SITE_URL = os.environ.get('SITE_URL', 'http://localhost:3000')

# ==========================================================================
# AI synthesis
# ==========================================================================
# Model id, configurable because Google retires them on its own schedule — the
# previously hardcoded `gemini-2.5-flash` now returns 404 for new API keys, and
# it was hardcoded in two separate modules. Keep this as the single definition.
# Which adapter to use: groq | cerebras | openrouter | gemini | openai | ollama | none.
#
# `none` (or simply no key) runs the product keyless — a supported mode, not a
# degraded one: answers and briefs are then assembled from the retrieved
# sources directly, with no inference spend at all.
#
# `groq` is the default because it is the only option that is free at a volume
# a public demo actually reaches: 14,400 requests/day on llama-3.1-8b-instant
# against Gemini's low-hundreds. Base URL, model and fallback chain all come
# from the preset in core/services/llm.py, so a working config is two variables.
LLM_PROVIDER = os.environ.get('LLM_PROVIDER', 'groq')

LLM_API_KEY = os.environ.get('LLM_API_KEY', '')

# Deliberately empty defaults. The provider preset supplies the model, the
# fallback chain and the base URL, so these override rather than define.
#
# They used to default to Gemini model ids regardless of provider, which meant
# LLM_PROVIDER=groq quietly sent `gemini-3.5-flash` to Groq and every call 404'd.
# Provider-specific defaults belong with the provider, not here.
LLM_MODEL = os.environ.get('LLM_MODEL', '')

# Only needed for a server without a preset — Ollama, vLLM, LM Studio.
# e.g. http://localhost:11434/v1
LLM_BASE_URL = os.environ.get('LLM_BASE_URL', '')

# Tried in order when the primary model is unavailable. Unset means "use the
# provider's preset chain". Two distinct failures make this load-bearing:
# hosted models return transient 503 under load, and free tiers return 429 when
# the day's quota for one model is gone while another model still has budget.
LLM_FALLBACK_MODELS = [
    m.strip() for m in os.environ.get('LLM_FALLBACK_MODELS', '').split(',') if m.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'ninja',
    'django_celery_beat',
    'corsheaders',

    # Local
    'core',
    'api',
    'django.contrib.postgres',
]

MIDDLEWARE = [
    # Outermost so the request id covers everything below it, including the
    # time spent in gzip and security middleware.
    'core.middleware.RequestContextMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS & CSRF Configuration
FRONTEND_URLS = os.environ.get('FRONTEND_URL', 'http://localhost:3000').split(',')

CORS_ALLOWED_ORIGINS = FRONTEND_URLS
CSRF_TRUSTED_ORIGINS = FRONTEND_URLS
CORS_ALLOW_CREDENTIALS = True

# Security & Proxy Settings
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

import dj_database_url

# Connection reuse.
#
# The process count that actually reaches Postgres is
#   gunicorn workers + (celery workers x concurrency) x 3 queues
# which exhausts a default max_connections=100 long before CPU is the limit.
#
# CONN_MAX_AGE holds a connection open per process between requests. Behind
# pgbouncer in transaction-pooling mode that is counterproductive — the pooler
# is doing the reuse — so set DB_CONN_MAX_AGE=0 there and let pgbouncer own it.
# CONN_HEALTH_CHECKS stops a persistent connection being handed out after the
# server has closed it, which otherwise surfaces as an intermittent
# InterfaceError under load.
DB_CONN_MAX_AGE = int(os.environ.get('DB_CONN_MAX_AGE', '600'))

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/ultranews'),
        conn_max_age=DB_CONN_MAX_AGE,
        conn_health_checks=True,
    )
}

# Server-side cursors are incompatible with transaction pooling; disable when
# a pooler sits in front.
if os.environ.get('DB_DISABLE_SERVER_SIDE_CURSORS', '0') == '1':
    DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True

# Cache backend.
#
# `locmem` makes Redis optional, which is what allows a genuinely $0 deployment
# (see DEPLOYMENT.md). Verified: the API serves normally on it, and the
# Redis-backed extras — the breaking-news ticker and pattern invalidation —
# degrade quietly rather than erroring.
#
# The trade is that the cache is per-process, so this is only correct on a
# single-process deployment. Anything running multiple workers needs Redis, or
# each worker keeps its own divergent copy.
if os.environ.get("CACHE_BACKEND", "redis").lower() == "locmem":
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "ultranews",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": os.environ.get("REDIS_URL", "redis://redis:6379/1"),
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
            }
        }
    }

# Celery Configuration
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1")

# Whether background tasks may be queued at all.
#
# Set to 0 on deployments with no Celery worker. `.delay()` against an
# unreachable broker does not fail fast: it retries, and the call blocks for
# seconds before raising — measured at 5.9s locally and ~39s on a GitHub
# runner, *per call*. Clustering dispatches one per promoted story, so on the
# worker-less path that cost is paid hundreds of times per run for work that
# could never have been picked up. It is what turned a routine pipeline run
# into a 25-minute timeout.
#
# `run_pipeline` disables this for itself, since it synthesises in-process.
CELERY_DISPATCH_ENABLED = os.environ.get("CELERY_DISPATCH_ENABLED", "1") == "1"
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/1")
CELERY_TIMEZONE = "UTC"

# Celery Beat — Automated task scheduling
# Decoupled: scraping and clustering run independently so a failed scrape never blocks clustering.
from celery.schedules import crontab

# Ingest cadence.
#
# 15 minutes is affordable now that the scraper sends If-None-Match /
# If-Modified-Since: a publisher with nothing new answers 304 with no body, so
# a poll of an idle feed costs one round trip rather than a full download. The
# old 30-minute interval was sized for a scraper that re-downloaded every feed —
# and every article in it — on every run.
#
# Deep-fetch work is proportional to NEW articles, so halving the interval does
# not double the cost; it mostly doubles the number of cheap 304s.
INGEST_INTERVAL_SECONDS = int(os.environ.get('INGEST_INTERVAL_SECONDS', 15 * 60))

# Clustering is the freshness bottleneck, not scraping — an article is invisible
# until it has been clustered. Kept tight, and cheap because it no-ops when
# nothing is pending.
CLUSTER_INTERVAL_SECONDS = int(os.environ.get('CLUSTER_INTERVAL_SECONDS', 3 * 60))

CELERY_BEAT_SCHEDULE = {
    'scrape-all-sources': {
        'task': 'core.tasks.scrape_all_sources',
        'schedule': INGEST_INTERVAL_SECONDS,
        'options': {'queue': 'celery'},
    },
    'cluster-pending-articles': {
        'task': 'core.tasks.cluster_pending_articles',
        'schedule': CLUSTER_INTERVAL_SECONDS,
        'options': {'queue': 'cluster'},
    },
    # Momentum decays with the clock, not with writes, so it needs its own
    # sweep. Cheap: one aggregate over a bounded window plus one bulk UPDATE.
    'refresh-momentum': {
        'task': 'core.tasks.refresh_momentum_scores',
        'schedule': 5 * 60,
        'options': {'queue': 'cluster'},
    },
    'compute-trust-metrics-daily': {
        'task': 'core.tasks.compute_trust_metrics',
        'schedule': crontab(hour=3, minute=0),  # Daily at 03:00 UTC
        'options': {'queue': 'celery'},
    },
    # Offset from the trust job so two long maintenance passes don't contend.
    'apply-retention-daily': {
        'task': 'core.tasks.apply_retention',
        'schedule': crontab(hour=4, minute=30),  # Daily at 04:30 UTC
        'options': {'queue': 'celery'},
    },
}

# ==========================================================================
# Data retention
# ==========================================================================
# Measured at ~9.2 KB per article and ~3.7 KB per raw document, roughly
# 3.3 GB/year of articles at 1,000 articles a day. Tiered rather than a single
# delete horizon — see core/retention.py for what each tier releases and why.
#
# Set RETENTION_ENABLED=0 to keep a permanent archive.
RETENTION_ENABLED = os.environ.get('RETENTION_ENABLED', '1') == '1'

# Full extracted text. Only needed to embed and to synthesise, both within hours.
RETENTION_RAW_DOCUMENT_DAYS = int(os.environ.get('RETENTION_RAW_DOCUMENT_DAYS', '14'))

# Body HTML and vectors on old articles. Clustering only looks back 7 days, so
# these are index weight long before this horizon. The article row survives.
RETENTION_ARTICLE_PAYLOAD_DAYS = int(os.environ.get('RETENTION_ARTICLE_PAYLOAD_DAYS', '45'))

# Single-source stories nobody else ever picked up. Set to 0 to keep them.
RETENTION_UNCORROBORATED_STORY_DAYS = int(
    os.environ.get('RETENTION_UNCORROBORATED_STORY_DAYS', '90')
)

# ==========================================================================
# Observability
# ==========================================================================
# Prometheus scrape endpoint. Restricted to an allowlist because the metrics
# describe internal state (backlog depth, failure counts) and there is no reason
# to publish that. Empty list = open, which is fine when the port is private.
METRICS_ENABLED = os.environ.get('METRICS_ENABLED', '1') == '1'
METRICS_ALLOWED_IPS = [
    ip.strip() for ip in os.environ.get('METRICS_ALLOWED_IPS', '').split(',') if ip.strip()
]
# Optional bearer token, for when the scraper is not on a trusted network.
METRICS_TOKEN = os.environ.get('METRICS_TOKEN', '')

# Error tracking. Entirely optional and off by default — this is open source and
# nobody self-hosting should be shipping their exceptions to a third party
# without explicitly choosing to.
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
SENTRY_ENVIRONMENT = os.environ.get('SENTRY_ENVIRONMENT', 'development')
SENTRY_TRACES_SAMPLE_RATE = float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.0'))

if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=SENTRY_ENVIRONMENT,
            integrations=[DjangoIntegration(), CeleryIntegration()],
            traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
            # Reader questions and article text are not ours to forward.
            send_default_pii=False,
        )
    except ImportError:
        import warnings
        warnings.warn(
            'SENTRY_DSN is set but sentry-sdk is not installed; '
            'error tracking is disabled.', stacklevel=2
        )

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==========================================================================
# V3: Structured Logging (structlog + stdlib)
# ==========================================================================
# In production, emit JSON logs to stderr for log aggregation.
# In dev, use human-readable console output.
import structlog

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': structlog.stdlib.ProcessorFormatter,
            'processor': structlog.dev.ConsoleRenderer() if DEBUG else structlog.processors.JSONRenderer(),
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO' if not DEBUG else 'DEBUG',
    },
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'django.request': {'handlers': ['console'], 'level': 'ERROR', 'propagate': False},
        'core': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'api': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        # Suppress noisy third-party loggers
        'trafilatura': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'feedparser': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'urllib3': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
    },
}

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
