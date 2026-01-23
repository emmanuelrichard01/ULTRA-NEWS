from ninja import NinjaAPI, Schema
from ninja.security import APIKeyHeader
from typing import List, Optional
from core.models import Article
from django.shortcuts import get_object_or_404
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.conf import settings
from django.core.cache import cache
from datetime import datetime
import os
import threading
import time
import sys

api = NinjaAPI(
    title="ULTRA-NEWS API",
    version="2.0",
    description="Production-grade news aggregation API"
)


# Security: API Key authentication for admin endpoints
class AdminApiKey(APIKeyHeader):
    """Validates X-Admin-Key header against ADMIN_API_KEY environment variable."""
    param_name = "X-Admin-Key"
    
    def authenticate(self, request, key):
        admin_key = getattr(settings, 'ADMIN_API_KEY', '') or os.environ.get('ADMIN_API_KEY', '')
        if admin_key and key == admin_key:
            return key
        return None


class SourceSchema(Schema):
    name: str


class ArticleSchema(Schema):
    id: int
    title: str
    slug: str
    url: str
    image_url: Optional[str] = None
    published_date: datetime
    source: SourceSchema


class ArticleDetailSchema(ArticleSchema):
    content: str


# ============================================================================
# Health & Monitoring
# ============================================================================

@api.get("/health")
def health(request):
    """
    Deep health check - verifies database and cache connectivity.
    Returns degraded status if any dependency is unreachable.
    """
    status = {"status": "ok", "db": "ok", "cache": "ok"}
    
    try:
        # Database check
        Article.objects.first()
    except Exception as e:
        status["status"] = "degraded"
        status["db"] = f"error: {str(e)[:50]}"
    
    try:
        # Cache/Redis check
        cache.set("health_check", "ok", 1)
        if cache.get("health_check") != "ok":
            raise Exception("Cache read mismatch")
    except Exception as e:
        status["status"] = "degraded"
        status["cache"] = f"error: {str(e)[:50]}"
    
    return status


# ============================================================================
# Public API Endpoints
# ============================================================================

from ninja.pagination import paginate


@api.get("/news", response=List[ArticleSchema])
@paginate
def list_news(request, q: Optional[str] = None, category: Optional[str] = None):
    """
    List articles with optional search and category filtering.
    Supports pagination via limit/offset query params.
    """
    # Input validation: limit query length to prevent abuse
    if q and len(q) > 200:
        q = q[:200]
    
    qs = Article.objects.select_related('source').prefetch_related('categories')

    if category:
        qs = qs.filter(categories__slug__iexact=category)

    if q:
        vector = SearchVector('title', weight='A') + SearchVector('content', weight='B')
        query = SearchQuery(q)
        qs = qs.annotate(rank=SearchRank(vector, query)).filter(rank__gte=0.1).order_by('-rank')
    else:
        qs = qs.order_by('-published_date')
    
    return qs


@api.get("/articles/{slug}", response=ArticleDetailSchema)
def get_article(request, slug: str):
    """
    Get a single article by slug with caching.
    """
    # Input validation
    if len(slug) > 500:
        slug = slug[:500]
    
    # Check cache first
    cache_key = f"article:{slug}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    article = get_object_or_404(Article.objects.select_related('source'), slug=slug)
    
    # Cache for 5 minutes
    cache.set(cache_key, article, timeout=300)
    
    return article


# ============================================================================
# Admin Endpoints (Protected)
# ============================================================================

@api.post("/admin/trigger-ingest", auth=AdminApiKey())
def trigger_ingest(request):
    """
    Trigger ingestion after HTTP response is sent.
    Uses timer delay to ensure response completes before scraping starts.
    Requires X-Admin-Key header.
    """
    def delayed_ingest():
        time.sleep(2)
        with open(os.devnull, 'w') as devnull:
            old_stdout, old_stderr = sys.stdout, sys.stderr
            sys.stdout = sys.stderr = devnull
            try:
                from core.tasks import scrape_all_sources
                scrape_all_sources()
            except Exception:
                pass
            finally:
                sys.stdout, sys.stderr = old_stdout, old_stderr
    
    threading.Thread(target=delayed_ingest, daemon=True).start()
    return "OK"


@api.post("/admin/seed-db", auth=AdminApiKey())
def seed_db(request):
    """
    Seed database with initial Sources and Categories.
    Runs migrations first. Requires X-Admin-Key header.
    """
    from django.core.management import call_command
    from core.models import Source, Category
    import io

    output = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = output

    try:
        call_command('migrate', interactive=False)

        categories = ['Tech', 'Politics', 'Business', 'Entertainment', 'Science', 'Art']
        cat_results = []
        for cat_name in categories:
            _, created = Category.objects.get_or_create(name=cat_name, slug=cat_name.lower())
            cat_results.append(f"{cat_name}: {'Created' if created else 'Exists'}")

        SOURCES = [
            {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "scraper_type": "rss"},
            {"name": "Wired", "url": "https://www.wired.com/feed/rss", "scraper_type": "rss"},
            {"name": "BBC News", "url": "https://feeds.bbci.co.uk/news/world/rss.xml", "scraper_type": "rss"},
            {"name": "TechCrunch", "url": "https://techcrunch.com/feed/", "scraper_type": "rss"},
            {"name": "Ars Technica", "url": "https://arstechnica.com/feed/", "scraper_type": "rss"},
            {"name": "NYT Technology", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", "scraper_type": "rss"}
        ]
        source_results = []
        for s in SOURCES:
            _, created = Source.objects.get_or_create(
                url=s["url"],
                defaults={"name": s["name"], "scraper_type": s["scraper_type"]}
            )
            source_results.append(f"{s['name']}: {'Created' if created else 'Exists'}")
        
        sys.stdout = old_stdout
        
        return {
            "status": "completed",
            "categories": cat_results,
            "sources": source_results
        }

    except Exception as e:
        sys.stdout = old_stdout
        return {
            "status": "error",
            "error": str(e),
            "output_log": output.getvalue()
        }
