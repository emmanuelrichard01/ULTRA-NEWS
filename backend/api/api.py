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

@api.get("/news", response=List[ArticleSchema])
# Cache for 5 minutes (300 seconds)
# Note: Ninja decorators wrap the view, but standard Django cache_page needs a bit of care.
# The simplest way in Ninja is often just using the decorator on the function logic if it was a view, 
# but Ninja views are a bit different. 
# However, 'django-ninja' usually works with standard decorators if applied correctly.
# Let's use a manual cache check or a simple wrapper for now to be safe, 
# OR just rely on standard cache_page if using a sync view.
def list_news(request, q: Optional[str] = None, category: Optional[str] = None):
    # To use cache_page with Ninja, we can manually check cache or use a utility.
    # For now, let's use the low-level cache API for explicit control in the function body
    # This is often cleaner with Ninja than View decorators.
    from django.core.cache import cache
    
    cache_key = f"latest_news_headlines_q{q}_c{category}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return cached_data
       
    # Start with base queryset
    qs = Article.objects.select_related('source').all().order_by('-published_date')

    if category:
        qs = qs.filter(categories__slug__iexact=category)

    if q:
        vector = SearchVector('title', weight='A') + SearchVector('content', weight='B')
        query = SearchQuery(q)
        # using rank__gte=0.1 to avoid very poor matches
        data = qs.annotate(rank=SearchRank(vector, query)).filter(rank__gte=0.1).order_by('-rank')[:50]
    else:
        data = qs[:100]

    # Evaluate query to cache list
    result = list(data) 
    cache.set(cache_key, result, timeout=300)
    return result

@api.get("/articles/{slug}", response=ArticleDetailSchema)
def get_article(request, slug: str):
    article = get_object_or_404(Article.objects.select_related('source'), slug=slug)
    # If using RSS scraper, 'content' might be empty or raw HTML.
    # The frontend should handle sanitization/rendering.
    return article
