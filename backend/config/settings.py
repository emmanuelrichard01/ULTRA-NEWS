import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-default-key')

# SECURITY: Default to False in production
DEBUG = os.environ.get('DEBUG', '0') == '1'

# SECURITY: Explicit allowed hosts (no wildcards in production)
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Admin API Key for protected endpoints
ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', '')

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
    'corsheaders',  # <--- Added
    
    # Local
    'core',
    'api',
    'django.contrib.postgres',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', # <--- Added (Must be before CommonMiddleware)
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS & CSRF Configuration
# -------------------------
# Read allowed origins from env var (comma separated)
# Example: FRONTEND_URL=https://ultra-news.vercel.app,http://localhost:3000

FRONTEND_URLS = os.environ.get('FRONTEND_URL', 'http://localhost:3000').split(',')

CORS_ALLOWED_ORIGINS = FRONTEND_URLS
CSRF_TRUSTED_ORIGINS = FRONTEND_URLS
CORS_ALLOW_CREDENTIALS = True

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

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/ultranews'),
        conn_max_age=600
    )
}

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
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/1")
CELERY_TIMEZONE = "UTC"

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Logging configuration - suppress verbose output in production
# This prevents "output too large" errors from cron services
if not DEBUG:
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': True,
        'handlers': {
            'null': {
                'class': 'logging.NullHandler',
            },
        },
        'root': {
            'handlers': ['null'],
            'level': 'CRITICAL',
        },
        'loggers': {
            'django': {'handlers': ['null'], 'level': 'CRITICAL', 'propagate': False},
            'django.request': {'handlers': ['null'], 'level': 'CRITICAL', 'propagate': False},
            'core': {'handlers': ['null'], 'level': 'CRITICAL', 'propagate': False},
            'trafilatura': {'handlers': ['null'], 'level': 'CRITICAL', 'propagate': False},
            'feedparser': {'handlers': ['null'], 'level': 'CRITICAL', 'propagate': False},
            'urllib3': {'handlers': ['null'], 'level': 'CRITICAL', 'propagate': False},
        },
    }

