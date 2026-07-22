import base64
import jwt
import requests
from ninja.security import HttpBearer
import logging
import os

from ninja import NinjaAPI, Schema
from pydantic import Field
from ninja.security import APIKeyHeader
from typing import List, Optional
from datetime import datetime

from django.shortcuts import get_object_or_404
from django.contrib.postgres.search import SearchQuery, SearchRank
from django.core.cache import cache
from django.db.models import F

from core.models import Article, Story, Source

logger = logging.getLogger(__name__)

api = NinjaAPI(
    title="ULTRA-NEWS API",
    version="3.0",
    description="V3 — Story-centric news aggregation API with cursor pagination",
    urls_namespace="api_v1",
)




# ==========================================================================
# Rate Limiting
# ==========================================================================

from functools import wraps
from ninja.errors import HttpError

def rate_limit(requests=60, window=60):
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            ip = request.META.get("REMOTE_ADDR")
            forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
            if forwarded:
                ip = forwarded.split(',')[0].strip()
            
            key = f"rl:{func.__name__}:{ip}"
            
            count = cache.get(key, 0)
            if count >= requests:
                raise HttpError(429, "Too Many Requests")
            
            if count == 0:
                cache.set(key, 1, timeout=window)
            else:
                cache.incr(key)
                
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

# ==========================================================================
# Security: GitHub OIDC Token Validation for Admin Endpoints
# ==========================================================================

class GitHubOIDCAuth(HttpBearer):
    """Validates GitHub Actions OIDC JWT tokens."""
    
    def get_jwks(self):
        jwks_url = "https://token.actions.githubusercontent.com/.well-known/jwks"
        jwks = cache.get("github_jwks")
        if not jwks:
            response = requests.get(jwks_url)
            response.raise_for_status()
            jwks = response.json()
            cache.set("github_jwks", jwks, 86400) # Cache for 24 hours
        return jwks

    def authenticate(self, request, token):
        try:
            jwks = self.get_jwks()
            # Fetch public key for the token
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = {}
            for key in jwks["keys"]:
                if key["kid"] == unverified_header["kid"]:
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }
            if not rsa_key:
                logger.error("Unable to find appropriate key.")
                return None
                
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(rsa_key)
            
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience="api://default",
                issuer="https://token.actions.githubusercontent.com"
            )
            
            # Optional: restrict to specific repo
            # if payload.get("repository") != "my-org/my-repo":
            #     return None
                
            return payload
        except Exception as e:
            logger.error(f"OIDC Token validation failed: {e}")
            return None


class AdminApiKey(APIKeyHeader):
    param_name = "X-Admin-Key"

    def authenticate(self, request, key):
        expected_key = os.environ.get("ADMIN_API_KEY")
        if expected_key and key == expected_key:
            return key
        return None


# ==========================================================================
# Schemas
# ==========================================================================

class SourceSchema(Schema):
    name: str


class ArticleSchema(Schema):
    id: int
    title: str
    slug: str
    url: str
    image_url: Optional[str] = None
    excerpt: str
    published_date: datetime
    source: SourceSchema


class ArticleDetailSchema(ArticleSchema):
    """V3: Returns excerpt + source_url for outbound. No raw HTML body."""
    content_hash: str


class StorySchema(Schema):
    id: int
    title: str
    slug: str
    summary: str
    first_seen_at: datetime
    last_updated_at: datetime
    source_count: int
    status: str
    image_url: Optional[str] = None  # Derived from first article


class StoryDetailSchema(StorySchema):
    articles: List[ArticleSchema]


class CursorPageSchema(Schema):
    """Cursor-based pagination response."""
    items: list
    next_cursor: Optional[str] = None
    previous_cursor: Optional[str] = None
    count: int


# ==========================================================================
# Cursor Pagination Helpers
# ==========================================================================

def encode_cursor(published_date: datetime, pk: int) -> str:
    """Encode a (published_date, id) pair as an opaque cursor string."""
    raw = f"{published_date.isoformat()}|{pk}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    """Decode an opaque cursor string back to (published_date, id)."""
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    date_str, pk_str = raw.split("|")
    return datetime.fromisoformat(date_str), int(pk_str)


def encode_story_cursor(velocity_score: float, first_seen_at: datetime, pk: int) -> str:
    """Encode a (velocity_score, first_seen_at, id) tuple as an opaque cursor string."""
    raw = f"{velocity_score}|{first_seen_at.isoformat()}|{pk}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_story_cursor(cursor: str) -> tuple[float, datetime, int]:
    """Decode an opaque cursor string back to (velocity_score, first_seen_at, id)."""
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    parts = raw.split("|")
    return float(parts[0]), datetime.fromisoformat(parts[1]), int(parts[2])


# ==========================================================================
# Health & Monitoring
# ==========================================================================

@api.get("/health")
def health(request):
    """
    Deep health check — verifies database and cache connectivity.
    Returns degraded status if any dependency is unreachable.
    """
    status = {"status": "ok", "db": "ok", "cache": "ok"}

    try:
        Article.objects.first()
        
        last_ingest = cache.get("last_successful_ingest_at")
        if last_ingest:
            from django.utils import timezone
            diff = timezone.now() - last_ingest
            if diff.total_seconds() > 45 * 60:
                raise Exception(f"No successful ingest for {diff.total_seconds() / 60:.1f} minutes")
    except Exception as e:
        status["status"] = "degraded"
        status["db"] = f"error: {str(e)[:50]}"

    try:
        cache.set("health_check", "ok", 1)
        if cache.get("health_check") != "ok":
            raise Exception("Cache read mismatch")
    except Exception as e:
        status["status"] = "degraded"
        status["cache"] = f"error: {str(e)[:50]}"

    return status


# ==========================================================================
# Public API — Stories (V3 primary entity)
# ==========================================================================

@api.get("/stories", response=dict)
@rate_limit(60, 60)
def list_stories(
    request,
    cursor: Optional[str] = None,
    limit: int = 20,
    category: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    List story clusters with cursor pagination.
    Stories are the V3 primary entity — aggregated multi-source coverage.
    """
    limit = min(limit, 50)  # Cap page size

    qs = Story.objects.prefetch_related('articles__source', 'categories')

    # Build filtered queryset (before cursor application)
    if category:
        qs = qs.filter(categories__slug__iexact=category)
    if status:
        qs = qs.filter(status=status)

    # Count BEFORE cursor pagination — cache it to avoid expensive COUNT per page load
    count_cache_key = f"stories_count:{category or 'all'}:{status or 'all'}"
    filtered_count = cache.get(count_cache_key)
    if filtered_count is None:
        filtered_count = qs.count()
        cache.set(count_cache_key, filtered_count, timeout=60)

    qs = qs.order_by('-velocity_score', '-first_seen_at', '-id')

    # Apply cursor
    if cursor:
        try:
            cursor_vel, cursor_date, cursor_id = decode_story_cursor(cursor)
            from django.db.models import Q
            qs = qs.filter(
                Q(velocity_score__lt=cursor_vel) |
                Q(velocity_score=cursor_vel, first_seen_at__lt=cursor_date) |
                Q(velocity_score=cursor_vel, first_seen_at=cursor_date, id__lt=cursor_id)
            )
        except Exception:
            pass  # Invalid cursor — return from beginning

    stories = list(qs[:limit + 1])
    has_next = len(stories) > limit
    stories = stories[:limit]

    # Build response
    items = []
    for story in stories:
        story_articles = list(story.articles.all())
        first_article = story_articles[0] if story_articles else None
        
        # Deduplicate sources in Python to use prefetched data
        sources_seen = set()
        sources_list = []
        framing_preview = []
        for art in story_articles:
            if art.source.name not in sources_seen:
                sources_seen.add(art.source.name)
                sources_list.append(art.source.name)
                if len(framing_preview) < 3:
                    framing_preview.append({
                        "source": art.source.name,
                        "title": art.title,
                        "url": art.url
                    })
                if len(sources_list) == 5:
                    break
                    
        items.append({
            "id": story.id,
            "title": story.title,
            "slug": story.slug,
            "summary": story.summary,
            "first_seen_at": story.first_seen_at.isoformat(),
            "last_updated_at": story.last_updated_at.isoformat(),
            "source_count": story.source_count,
            "independent_count": story.independent_count,
            "velocity_score": story.velocity_score,
            "status": story.status,
            "image_url": first_article.image_url if first_article else None,
            "categories": [cat.slug for cat in story.categories.all()],
            "sources": sources_list,
            "framing_preview": framing_preview,
        })

    next_cursor = None
    if has_next and stories:
        last = stories[-1]
        next_cursor = encode_story_cursor(last.velocity_score, last.first_seen_at, last.id)

    return {
        "items": items,
        "next_cursor": next_cursor,
        "count": filtered_count,
    }


@api.get("/stories/{story_slug}", response=dict)
@rate_limit(60, 60)
def get_story(request, story_slug: str):
    """
    Get a story cluster by slug — shows all contributing articles/sources.
    This is the page that 'sells the product' (V3 UI spec §4.2).
    """
    cache_key = f"story:{story_slug}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    story = get_object_or_404(
        Story.objects.prefetch_related('articles__source', 'categories'),
        slug=story_slug,
    )

    articles = []
    for article in story.articles.select_related('source').order_by('-published_date'):
        articles.append({
            "id": article.id,
            "title": article.title,
            "slug": article.slug,
            "url": article.url,
            "excerpt": article.excerpt,
            "image_url": article.image_url,
            "published_date": article.published_date.isoformat(),
            "source": {"name": article.source.name},
        })

    result = {
        "id": story.id,
        "title": story.title,
        "slug": story.slug,
        "summary": story.summary,
        "first_seen_at": story.first_seen_at.isoformat(),
        "last_updated_at": story.last_updated_at.isoformat(),
        "source_count": story.source_count,
        "independent_count": story.independent_count,
        "velocity_score": story.velocity_score,
        "status": story.status,
        "categories": list(story.categories.values_list('slug', flat=True)),
        "articles": articles,
    }

    cache.set(cache_key, result, timeout=300)
    return result


# ==========================================================================
# Public API — Articles (V3: excerpt-only display model)
# ==========================================================================

@api.get("/news", response=dict)
@rate_limit(60, 60)
def list_news(
    request,
    q: Optional[str] = None,
    category: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = 20,
    # Legacy offset support for backward compatibility
    offset: Optional[int] = None,
):
    """
    List articles with optional search and category filtering.
    Supports cursor pagination (preferred) and legacy offset pagination.
    """
    limit = min(limit, 50)

    # Input validation: limit query length
    if q and len(q) > 200:
        q = q[:200]

    qs = Article.objects.select_related('source', 'story').prefetch_related('categories')

    if category:
        qs = qs.filter(categories__slug__iexact=category)

    if q:
        # Use stored SearchVectorField if populated, fallback to annotation
        query = SearchQuery(q)
        qs = qs.filter(search_vector=query).annotate(
            rank=SearchRank(F('search_vector'), query)
        ).order_by('-rank')
    else:
        qs = qs.order_by('-published_date', '-id')

    # Cursor pagination (preferred)
    if cursor and not q:  # Can't use cursor with search ranking
        try:
            cursor_date, cursor_id = decode_cursor(cursor)
            qs = qs.filter(
                published_date__lte=cursor_date,
            ).exclude(
                published_date=cursor_date,
                id__gte=cursor_id,
            )
        except Exception:
            pass

    # Legacy offset support
    if offset is not None and not cursor:
        logger.warning(
            "DEPRECATION WARNING: Offset pagination is deprecated. "
            "Please migrate to cursor-based pagination (/api/v1/articles)."
        )
        qs = qs[offset:offset + limit + 1]
        items_list = list(qs)
        has_next = len(items_list) > limit
        items_list = items_list[:limit]
    else:
        items_list = list(qs[:limit + 1])
        has_next = len(items_list) > limit
        items_list = items_list[:limit]

    items = []
    for article in items_list:
        items.append({
            "id": article.id,
            "title": article.title,
            "slug": article.slug,
            "url": article.url,
            "image_url": article.image_url,
            "excerpt": article.excerpt,
            "published_date": article.published_date.isoformat(),
            "source": {"name": article.source.name},
            "story_slug": article.story.slug if article.story else None,
            "story_source_count": article.story.source_count if article.story else 1,
            "story_status": article.story.status if article.story else "wire",
        })

    next_cursor = None
    if has_next and items_list and not q:
        last = items_list[-1]
        next_cursor = encode_cursor(last.published_date, last.id)

    # Count reflects active filters (category, search), not global total
    filtered_count = Article.objects.count() if not (category or q) else len(items)
    if category or q:
        # Re-query for accurate filtered count (without cursor/limit)
        count_qs = Article.objects.select_related('source', 'story')
        if category:
            count_qs = count_qs.filter(categories__slug__iexact=category)
        if q:
            query = SearchQuery(q)
            count_qs = count_qs.filter(search_vector=query)
        filtered_count = count_qs.count()

    return {
        "items": items,
        "next_cursor": next_cursor,
        "count": filtered_count,
    }


@api.get("/articles/{slug}", response=dict)
@rate_limit(60, 60)
def get_article(request, slug: str):
    """
    Get a single article by slug.
    V3: Returns excerpt + source outbound URL. No raw HTML body rendering.
    """
    if len(slug) > 500:
        slug = slug[:500]

    cache_key = f"article:{slug}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    article = get_object_or_404(
        Article.objects.select_related('source', 'story'),
        slug=slug,
    )

    result = {
        "id": article.id,
        "title": article.title,
        "slug": article.slug,
        "url": article.url,
        "image_url": article.image_url,
        "excerpt": article.excerpt,
        "published_date": article.published_date.isoformat(),
        "source": {"name": article.source.name},
        "story_slug": article.story.slug if article.story else None,
        "story_source_count": article.story.source_count if article.story else 1,
        "story_status": article.story.status if article.story else "developing",
        "categories": list(article.categories.values_list('slug', flat=True)),
    }

    cache.set(cache_key, result, timeout=300)
    return result


# ==========================================================================
# Public API — Sources (Registry & Health)
# ==========================================================================

@api.get("/sources", response=list)
def list_sources(request):
    """
    Public endpoint listing all active news sources with health metadata.
    Used by the RSS/Sources page to show the inbound feed infrastructure.
    """
    from core.source_registry import SOURCES as REGISTRY_SOURCES, TIER_LABELS, REGION_LABELS
    
    from django.db.models import Count as DbCount
    sources = Source.objects.filter(is_active=True).annotate(
        _article_count=DbCount('articles')
    ).order_by('name')
    
    # Build a lookup from registry for tier/region metadata
    registry_lookup = {s["url"]: s for s in REGISTRY_SOURCES}
    
    result = []
    for s in sources:
        registry_entry = registry_lookup.get(s.url, {})
        tier = registry_entry.get("tier", 4)
        region = registry_entry.get("region", "global")
        result.append({
            "name": s.name,
            "url": s.url,
            "source_type": s.source_type,
            "tier": tier,
            "tier_label": TIER_LABELS.get(tier, "Unknown"),
            "region": region,
            "region_label": REGION_LABELS.get(region, region.title()),
            "is_active": s.is_active,
            "last_fetched_at": s.last_fetched_at.isoformat() if s.last_fetched_at else None,
            "consecutive_failures": s.consecutive_failures,
            "articles_broken_first": s.articles_broken_first,
            "corroboration_rate": round(s.corroboration_rate, 1),
            "article_count": s._article_count,
        })
    
    return result


# ==========================================================================
# Public API — Related Stories (Semantic Similarity)
# ==========================================================================

@api.get("/stories/{story_slug}/related", response=dict)
@rate_limit(60, 60)
def get_related_stories(request, story_slug: str, limit: int = 5):
    """
    Find semantically related story clusters using pgvector cosine similarity.
    Returns compact story summaries for the "Related Stories" section.
    """
    story = get_object_or_404(Story, slug=story_slug)
    
    if not story.embedding:
        return {"items": []}
    
    try:
        from pgvector.django import CosineDistance
        
        limit = min(limit, 10)
        related = Story.objects.prefetch_related('articles__source', 'categories').filter(
            embedding__isnull=False
        ).exclude(
            id=story.id
        ).order_by(
            CosineDistance('embedding', story.embedding)
        )[:limit]
        
        items = []
        for s in related:
            story_articles = list(s.articles.all())
            first_article = story_articles[0] if story_articles else None
            items.append({
                "id": s.id,
                "title": s.title,
                "slug": s.slug,
                "summary": s.summary,
                "first_seen_at": s.first_seen_at.isoformat(),
                "source_count": s.source_count,
                "independent_count": s.independent_count,
                "status": s.status,
                "image_url": first_article.image_url if first_article else None,
                "categories": [cat.slug for cat in s.categories.all()],
            })
        
        return {"items": items}
    except Exception as e:
        logger.warning("Related stories lookup failed for %s: %s", story_slug, e)
        return {"items": []}


# ==========================================================================
# RAG Endpoint (Semantic Intelligence)
# ==========================================================================

class AskRequest(Schema):
    query: str = Field(..., max_length=500)

class AskResponse(Schema):
    answer: str
    context_sources: List[str]
    synthesis_type: str = "extractive"

@api.post("/ask")
@rate_limit(10, 60)
def ask_the_wire_room(request, payload: AskRequest):
    """
    Phase 5: Ask the Wire Room RAG
    Embeds the user query, searches pgvector for relevant context,
    and returns a synthesized response.
    """
    from core.clustering import get_embedding_model
    from pgvector.django import CosineDistance
    from core.models import Article
    
    model = get_embedding_model()
    if not model:
        return {"answer": "Semantic embeddings are offline. Please try again later.", "context_sources": [], "synthesis_type": "extractive"}
        
    embeddings = list(model.embed([payload.query]))
    query_vector = [float(x) for x in embeddings[0]]
    
    # Vector Search using pgvector
    top_articles = Article.objects.filter(embedding__isnull=False)\
                                  .order_by(CosineDistance('embedding', query_vector))[:5]
                                  
    if not top_articles:
        return {"answer": "No relevant context found in the wire room to answer your query.", "context_sources": [], "synthesis_type": "extractive"}
        
    # Build context
    sources = set()
    for art in top_articles:
        sources.add(art.source.name)
        
    llm_api_key = os.environ.get("LLM_API_KEY")
    
    from django.http import StreamingHttpResponse
    import json
    
    if llm_api_key:
        def llm_stream():
            yield f"data: {json.dumps({'type': 'metadata', 'context_sources': list(sources), 'synthesis_type': 'llm'})}\n\n"
            try:
                from google import genai
                client = genai.Client(api_key=llm_api_key)
                
                context_text = "\n\n".join([f"Source: {art.source.name}\nHeadline: {art.title}\nExcerpt: {art.excerpt}" for art in top_articles])
                prompt = (
                    f"You are the 'Wire Room' intelligence brief generator. "
                    f"Synthesize the following reporting to answer the query: '{payload.query}'.\n\n"
                    f"Context:\n{context_text}\n\n"
                    f"Provide a concise, objective summary. Cite the sources provided."
                )
                
                response = client.models.generate_content_stream(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                for chunk in response:
                    if chunk.text:
                        yield f"data: {json.dumps({'type': 'chunk', 'text': chunk.text})}\n\n"
            except Exception as e:
                logger.error("LLM synthesis failed: %s", e)
                yield f"data: {json.dumps({'type': 'error', 'text': f'\\n\\n[Error: {str(e)}]'})}\n\n"
                
            yield "data: [DONE]\n\n"
            
        return StreamingHttpResponse(llm_stream(), content_type="text/event-stream")
    else:
        def fallback_stream():
            yield f"data: {json.dumps({'type': 'metadata', 'context_sources': list(sources), 'synthesis_type': 'extractive'})}\n\n"
            answer = f"Based on recent reporting from {', '.join(sources)}, here is what the wire says about '{payload.query}': \n\n"
            for art in top_articles:
                answer += f"- **{art.title}**: {art.excerpt}\n"
            yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"
            yield "data: [DONE]\n\n"
            
        return StreamingHttpResponse(fallback_stream(), content_type="text/event-stream")

# ==========================================================================
# Admin Endpoints (Protected)
# ==========================================================================

@api.post("/admin/trigger-ingest", auth=GitHubOIDCAuth())
def trigger_ingest(request):
    """
    Trigger ingestion via Celery task queue.
    V3: Uses Celery .delay() instead of raw threading — proper monitoring,
    retry support, and no stdout hijacking.
    """
    from core.tasks import scrape_all_sources
    result = scrape_all_sources.delay()
    logger.info("Ingestion task triggered: %s", result.id)
    return {"status": "triggered", "task_id": str(result.id)}


@api.post("/admin/seed-db", auth=AdminApiKey())
def seed_db(request):
    """
    Seed database with initial Sources and Categories.
    Runs migrations first. Requires X-Admin-Key header.

    Sources are imported from core.source_registry (single source of truth).
    """
    from django.core.management import call_command
    from core.categorization import seed_all_categories
    from core.source_registry import SOURCES

    try:
        call_command('migrate', interactive=False, verbosity=0)

        # Seed categories from centralized registry
        cat_results = []
        for name, created in seed_all_categories():
            cat_results.append(f"{name}: {'Created' if created else 'Exists'}")

        # Seed sources from centralized registry
        source_results = []
        registry_urls = {s["url"] for s in SOURCES}
        
        for s in SOURCES:
            obj, created = Source.objects.get_or_create(
                url=s["url"],
                defaults={
                    "name": s["name"],
                    "scraper_type": s["scraper_type"],
                    "source_type": s.get("source_type", "news"),
                    "is_active": True,
                }
            )
            if not created:
                # Update fields if they changed in the registry
                needs_save = False
                if obj.source_type != s.get("source_type", "news"):
                    obj.source_type = s.get("source_type", "news")
                    needs_save = True
                if obj.name != s["name"]:
                    obj.name = s["name"]
                    needs_save = True
                if not obj.is_active:
                    obj.is_active = True
                    needs_save = True
                if needs_save:
                    obj.save(update_fields=['source_type', 'name', 'is_active'])
            source_results.append(f"{s['name']}: {'Created' if created else 'Exists'}")

        # Deactivate sources no longer in the registry
        stale = Source.objects.filter(is_active=True).exclude(url__in=registry_urls)
        stale_names = list(stale.values_list('name', flat=True))
        stale_count = stale.update(is_active=False)

        return {
            "status": "completed",
            "categories": cat_results,
            "sources": source_results,
            "deactivated": stale_names,
            "deactivated_count": stale_count,
        }

    except Exception as e:
        logger.error("seed-db failed: %s", e)
        return {"status": "error", "error": str(e)}
