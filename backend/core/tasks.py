import uuid
import logging

from celery import shared_task, group
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.utils.text import slugify
from django.core.cache import cache

from core.models import Source, Article, RawDocument, Story
from core.services.scraper import ScraperService
from core.categorization import assign_categories_to_article
from core.clustering import cluster_article

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, soft_time_limit=30, queue='fetch')
def scrape_single_source(self, source_id):
    """
    I/O Bound task to fetch a single news source and save new articles.
    Articles are created with story=None so they can be clustered sequentially later.
    """
    try:
        source = Source.objects.get(id=source_id)
    except Source.DoesNotExist:
        return 0

    logger.info("Scraping %s...", source.name)
    service = ScraperService()
    count = 0

    try:
        articles_data = service.scrape_source(source)

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
                        story=None,  # Explicitly unset; clustered later
                    )

                    # Only save RawDocument if deep_fetch succeeded
                    if data.get('deep_fetch_success'):
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

                    count += 1

            except IntegrityError:
                logger.debug("Duplicate article skipped: %s", data['url'][:80])
                continue

        # Update source health tracking
        source.last_fetched_at = timezone.now()
        source.consecutive_failures = 0
        source.save(update_fields=['last_fetched_at', 'consecutive_failures'])

        logger.info("Saved %d new articles for %s", count, source.name)
        return count

    except Exception as e:
        # Track consecutive failures for circuit-breaker-style monitoring
        source.consecutive_failures += 1
        source.save(update_fields=['consecutive_failures'])
        logger.error("Failed to scrape %s (failure #%d): %s",
                     source.name, source.consecutive_failures, e)
        return 0


@shared_task(queue='cluster')
def cluster_pending_articles(fetch_results=None):
    """
    CPU Bound task to cluster all articles that have story=None.
    Sequentially processed to guarantee cluster deduplication (no race conditions).
    """
    lock_id = "clustering_lock"
    # Acquire lock for 5 minutes (300s) to prevent overlapping runs
    if not cache.add(lock_id, "locked", 300):
        logger.warning("Clustering already running. Skipping this cycle.")
        return "Locked"

    try:
        pending_articles = Article.objects.filter(story__isnull=True).order_by('published_date')
        processed = 0
        stories_touched = set()

        for article in pending_articles:
            # Cluster assigns the story and computes embedding
            cluster_article(article)
            if article.story_id:
                stories_touched.add(article.story_id)
            processed += 1

        # Recompute velocity score for touched stories only
        active_stories = Story.objects.filter(id__in=stories_touched)
        for story in active_stories:
            hours = (timezone.now() - story.first_seen_at).total_seconds() / 3600
            if hours > 0:
                story.velocity_score = story.source_count / hours
            else:
                story.velocity_score = story.source_count
            story.save(update_fields=['velocity_score'])

        # Mark ingest as successful for health checks
        cache.set("last_successful_ingest_at", timezone.now(), timeout=None)

        logger.info("Clustered %d pending articles across %d stories.", processed, len(stories_touched))
        return f"Clustered {processed} articles"
    finally:
        cache.delete(lock_id)


@shared_task(queue='celery')
def scrape_all_sources():
    """
    Dispatcher task: Fans out fetching across all active sources in parallel.
    Clustering is decoupled and runs on its own Celery Beat schedule (every 5 min).
    This avoids the chord fragility where one failed source blocks all clustering.
    """
    logger.info("Starting parallel ingestion...")
    sources = Source.objects.filter(is_active=True)
    if not sources.exists():
        return "No active sources"

    # Fire-and-forget parallel fetch — no chord callback
    fetch_group = group(scrape_single_source.s(s.id) for s in sources)
    fetch_group.apply_async()

    logger.info("Dispatched %d source fetch tasks.", sources.count())
    return f"Dispatched {sources.count()} fetch tasks"


@shared_task(queue='celery')
def compute_trust_metrics():
    """Nightly task to update source trust and corroboration metrics."""
    from core.trust import compute_trust_graph
    compute_trust_graph()
    return "Trust metrics updated"
