from ninja import NinjaAPI, Schema
from typing import List, Optional
from core.models import Article
from django.shortcuts import get_object_or_404
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

api = NinjaAPI()

from datetime import datetime

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

@api.get("/health")
def health(request):
    return {"status": "ok"}

from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator

from ninja.pagination import paginate

@api.get("/news", response=List[ArticleSchema])
@paginate # Default limit=100, page_size is configurable
def list_news(request, q: Optional[str] = None, category: Optional[str] = None):
    # To use cache_page with Ninja, we can manually check cache or use a utility.
    
    # Cache key needs to include pagination if we were caching the FULL response list.
    # However, 'paginate' wraps the response. Caching inside here caches the QUERYSET or list BEFORE pagination
    # if we return a queryset. 
    # BUT, 'paginate' executes the queryset slicing.
    
    # For simplicity in this "Head of Engineering" rigor:
    # We should cache based on params including page, BUT Ninja's paginate processes the result.
    # Let's return the QuerySet and let Ninja handle slicing. 
    # Caching the whole QuerySet is not efficient if evaluated. 
    # Caching the *results* of a specific page is better.
    # Given the complexity of adding caching + pagination properly in one go with decorators,
    # and the user asking for "pagination", let's prioritize functional pagination first.
    # We will remove the manual cache block for now or update it to be page-aware if we wanted perfection.
    # To avoid cache collision errors, I'll DISABLE the manual cache block for the list view for now
    # as pagination changes the data significantly per request.
    
    # Start with base queryset
    qs = Article.objects.select_related('source').all().order_by('-published_date')

    if category:
        qs = qs.filter(categories__slug__iexact=category)

    if q:
        vector = SearchVector('title', weight='A') + SearchVector('content', weight='B')
        query = SearchQuery(q)
        # using rank__gte=0.1 to avoid very poor matches
        qs = qs.annotate(rank=SearchRank(vector, query)).filter(rank__gte=0.1).order_by('-rank')
    
    return qs

@api.get("/articles/{slug}", response=ArticleDetailSchema)
def get_article(request, slug: str):
    article = get_object_or_404(Article.objects.select_related('source'), slug=slug)
    # If using RSS scraper, 'content' might be empty or raw HTML.
    return article

import threading
import time
import os
import sys

@api.post("/admin/trigger-ingest")
def trigger_ingest(request):
    """
    Trigger ingestion after HTTP response is sent.
    Uses timer delay to ensure response completes before scraping starts.
    """
    def delayed_ingest():
        # Wait for HTTP response to complete before starting
        time.sleep(2)
        # Suppress all stdout/stderr during ingestion
        with open(os.devnull, 'w') as devnull:
            old_stdout, old_stderr = sys.stdout, sys.stderr
            sys.stdout = sys.stderr = devnull
            try:
                from core.tasks import scrape_all_sources
                scrape_all_sources()
            except Exception:
                pass  # Silently fail
            finally:
                sys.stdout, sys.stderr = old_stdout, old_stderr
    
    threading.Thread(target=delayed_ingest, daemon=True).start()
    return "OK"

@api.post("/admin/seed-db")
def seed_db(request):
    """
    Manually seed the database with initial Sources and Categories.
    Useful for Render Free Tier where Shell access is paid.
    WARNING: Runs migrations first to ensure DB tables exist.
    """
    from django.core.management import call_command
    from core.models import Source, Category
    import sys
    import io

    # Capture stdout to see what happens
    output = io.StringIO()
    sys.stdout = output

    try:
        # 0. Run Migrations (Critical for empty DBs)
        call_command('migrate', interactive=False)
        print("Migrations completed.")

        # 1. Seed Categories
        categories = ['Tech', 'Politics', 'Business', 'Entertainment', 'Science', 'Art']
        cat_results = []
        for cat_name in categories:
            _, created = Category.objects.get_or_create(name=cat_name, slug=cat_name.lower())
            cat_results.append(f"{cat_name}: {'Created' if created else 'Exists'}")

        # 2. Seed Sources
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
        
        # Reset stdout
        sys.stdout = sys.__stdout__
        
        return {
            "status": "completed",
            "migration_output": "Migrations ran successfully.",
            "categories": cat_results,
            "sources": source_results
        }

    except Exception as e:
        sys.stdout = sys.__stdout__
        # Return the error details instead of 500
        return {
            "status": "error",
            "error": str(e),
            "output_log": output.getvalue()
        }
