import uuid
import logging

from celery import shared_task
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.utils.text import slugify
from django.core.cache import cache

from core.models import Source, Article, RawDocument
from core.services.scraper import ScraperService
from core.categorization import assign_categories_to_article
from core.clustering import cluster_article

logger = logging.getLogger(__name__)


@shared_task
def scrape_all_sources():
    """
    Background task to scrape all active news sources.
    Each source is processed independently — one source's failure
    doesn't affect others.
    """
    logger.info("Starting background scraping task...")
    sources = Source.objects.filter(is_active=True)
    service = ScraperService()

    total_new = 0

    for source in sources:
        logger.info("Scraping %s...", source.name)
        try:
            articles_data = service.scrape_source(source)
            count = 0

            for data in articles_data:
                try:
                    # Atomic: check + create to prevent TOCTOU race condition
                    with transaction.atomic():
                        if Article.objects.filter(url=data['url']).exists():
                            continue

                        # Handle slug collision
                        slug = slugify(data['title'])
                        if not slug:
                            slug = f"article-{uuid.uuid4().hex[:8]}"
                        if Article.objects.filter(slug=slug).exists():
                            slug = f"{slug}-{uuid.uuid4().hex[:6]}"

                        article = Article.objects.create(
                            source=source,
                            title=data['title'],
                            url=data['url'],
                            content=data['content'],
                            excerpt=data.get('excerpt', ''),
                            content_hash=data.get('content_hash', ''),
                            published_date=data['published_date'],
                            image_url=data.get('image_url'),
                            slug=slug,
                        )

                        # Store full content in RawDocument (internal only)
                        RawDocument.objects.create(
                            source=source,
                            article=article,
                            url=data['url'],
                            raw_content=data['content'],
                        )

                        # Auto-assign categories
                        assign_categories_to_article(
                            article, data['title'], data['content']
                        )

                        # Cluster into Story
                        cluster_article(article)

                        count += 1

                except IntegrityError:
                    # Another worker already created this article — skip
                    logger.debug("Duplicate article skipped: %s", data['url'][:80])
                    continue

            # Update source health tracking
            source.last_fetched_at = timezone.now()
            source.consecutive_failures = 0
            source.save(update_fields=['last_fetched_at', 'consecutive_failures'])

            logger.info("Saved %d new articles for %s", count, source.name)
            total_new += count

        except Exception as e:
            # Track consecutive failures for circuit-breaker-style monitoring
            source.consecutive_failures += 1
            source.save(update_fields=['consecutive_failures'])
            logger.error("Failed to scrape %s (failure #%d): %s",
                         source.name, source.consecutive_failures, e)

    logger.info("Scraping complete. Total new articles: %d", total_new)
    
    # Mark ingest as successful for health checks
    cache.set("last_successful_ingest_at", timezone.now(), timeout=None)
    
    # Simple velocity_score update for all active stories
    from core.models import Story
    active_stories = Story.objects.filter(status=Story.Status.DEVELOPING)
    for story in active_stories:
        # Simple velocity: source_count / hours_since_first_seen
        hours = (timezone.now() - story.first_seen_at).total_seconds() / 3600
        if hours > 0:
            story.velocity_score = story.source_count / hours
        else:
            story.velocity_score = story.source_count
        story.save(update_fields=['velocity_score'])
        
    return f"Scraped {total_new} articles"

@shared_task
def compute_trust_metrics():
    """Nightly task to update source trust and corroboration metrics."""
    from core.trust import compute_trust_graph
    compute_trust_graph()
    return "Trust metrics updated"
