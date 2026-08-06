import logging

from celery import group, shared_task
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.clustering import cluster_article, compute_velocity
from core.models import Article, RawDocument, Source, Story
from core.observability import (
    articles_ingested,
    articles_pending_clustering,
    clustering_duration,
    clustering_outcomes,
    ingest_outcomes,
    observe,
)
from core.services.scraper import FeedFetchError, FeedNotModified, ScraperService

logger = logging.getLogger(__name__)

# Ceiling on one clustering pass. The Redis lock is held for 300s, so a run must
# comfortably finish inside that window; anything left over is picked up by the
# next 5-minute cycle rather than overrunning the lock.
MAX_ARTICLES_PER_CLUSTER_RUN = 500


@shared_task(bind=True, max_retries=2, soft_time_limit=180, time_limit=240, queue='fetch')
def scrape_single_source(self, source_id):
    """
    I/O Bound task to fetch a single news source and save new articles.
    Articles are created with story=None so they can be clustered sequentially later.

    The time limit reflects the scraper's actual worst case: one feed request plus
    up to MAX_DEEP_FETCH_PER_RUN article pages fetched DEEP_FETCH_CONCURRENCY at a
    time. The old 30s limit was unreachable — deep fetches ran serially at 15s
    each, so nearly every run died partway through with SoftTimeLimitExceeded.
    """
    try:
        source = Source.objects.get(id=source_id)
    except Source.DoesNotExist:
        return 0

    logger.info("Scraping %s...", source.name)
    service = ScraperService()
    count = 0

    try:
        # Hand the scraper the URLs we already have so it deep-fetches only new
        # articles instead of re-downloading the whole feed every 30 minutes.
        known_urls = set(
            Article.objects.filter(source=source).values_list('url', flat=True)
        )
        try:
            result = service.scrape_source(source, skip_urls=known_urls)
        except FeedNotModified:
            # 304: the publisher confirmed nothing changed. A success, and the
            # cheapest possible one — no body transferred at all.
            ingest_outcomes.labels("not_modified").inc()
            _record_source_success(source)
            logger.info("%s unchanged since last fetch (304).", source.name)
            return 0
        except FeedFetchError as e:
            ingest_outcomes.labels("failure").inc()
            _record_source_failure(source, str(e))
            return 0

        articles_data = result.articles

        for data in articles_data:
            try:
                # Atomic: check + create to prevent TOCTOU race condition
                with transaction.atomic():
                    if Article.objects.filter(url=data['url']).exists():
                        continue

                    # Slug generation and collision handling live on the model,
                    # so every write path gets a unique slug — not just this one.
                    article = Article.objects.create(
                        source=source,
                        title=data['title'],
                        url=data['url'],
                        content=data['content'],
                        excerpt=data.get('excerpt', ''),
                        content_hash=data.get('content_hash', ''),
                        published_date=data['published_date'],
                        image_url=data.get('image_url'),
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

                    # Topics are NOT assigned here. Classification is semantic
                    # and needs the embedding, which clustering computes — see
                    # core.clustering._assign_topics. Keyword matching used to
                    # run at this point over the full article body, then get
                    # overwritten minutes later by the semantic pass: duplicate
                    # work whose result was discarded, against a keyword table
                    # still naming retired slugs.

                    count += 1

            except IntegrityError:
                logger.debug("Duplicate article skipped: %s", data['url'][:80])
                continue

        ingest_outcomes.labels("success").inc()
        articles_ingested.inc(count)
        _record_source_success(source, etag=result.etag, last_modified=result.last_modified)

        logger.info("Saved %d new articles for %s", count, source.name)
        return count

    except Exception as e:
        logger.exception("Unexpected error scraping %s", source.name)
        ingest_outcomes.labels("failure").inc()
        _record_source_failure(source, f"{type(e).__name__}: {str(e)[:120]}")
        return 0


def _record_source_success(source, etag: str = "", last_modified: str = "") -> None:
    """Mark a fetch as healthy and store the cache validators for next time."""
    now = timezone.now()
    source.last_fetched_at = now
    source.last_success_at = now
    source.consecutive_failures = 0
    source.last_error = ""
    fields = ['last_fetched_at', 'last_success_at', 'consecutive_failures', 'last_error']

    # A 304 returns no validators; keep the ones we already have.
    if etag or last_modified:
        source.etag = etag
        source.last_modified = last_modified
        fields += ['etag', 'last_modified']

    source.save(update_fields=fields)


def _record_source_failure(source, reason: str) -> None:
    """
    Record a failed fetch and trip the circuit breaker if it keeps failing.

    Failures used to be invisible: a fetch error returned an empty list, the task
    saw no exception, and stamped `consecutive_failures = 0`. Four permanently
    dead feeds — including both Tier-1 wire services — therefore reported as
    healthy indefinitely.
    """
    source.last_fetched_at = timezone.now()
    source.consecutive_failures += 1
    source.last_error = reason[:300]
    fields = ['last_fetched_at', 'consecutive_failures', 'last_error']

    if source.consecutive_failures >= Source.FAILURE_THRESHOLD and source.is_active:
        source.is_active = False
        source.deactivated_reason = (
            f"Auto-disabled after {source.consecutive_failures} consecutive failures: {reason}"[:300]
        )
        fields += ['is_active', 'deactivated_reason']
        logger.error(
            "Circuit breaker OPEN for %s after %d failures: %s",
            source.name, source.consecutive_failures, reason,
        )
    else:
        logger.warning(
            "Fetch failed for %s (failure #%d): %s",
            source.name, source.consecutive_failures, reason,
        )

    source.save(update_fields=fields)


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
        # Bounded batch: the lock expires after 5 minutes, so a run must finish
        # well inside that. Leftovers are picked up by the next cycle.
        pending_articles = (
            Article.objects.filter(story__isnull=True)
            .select_related('source')
            .order_by('published_date')[:MAX_ARTICLES_PER_CLUSTER_RUN]
        )

        processed = 0
        stories_touched = set()

        for article in pending_articles:
            try:
                # Cluster assigns the story, computes and persists the embedding,
                # and updates the cluster's counts, tier and velocity.
                with observe(clustering_duration):
                    story = cluster_article(article)
                clustering_outcomes.labels(
                    "matched" if story and story.source_count > 1 else "created"
                ).inc()
            except Exception:
                # One poisoned article must not abort the whole batch.
                clustering_outcomes.labels("failed").inc()
                logger.exception("Failed to cluster article %d", article.pk)
                continue
            if article.story_id:
                stories_touched.add(article.story_id)
            processed += 1

        # Velocity decays with age, so refresh it for every touched story even if
        # its article count did not change this cycle. compute_velocity() is the
        # single definition — this used to use a different formula than
        # clustering.py, so the feed ranking disagreed with the story page.
        for story in Story.objects.filter(id__in=stories_touched).only(
            'id', 'independent_count', 'first_seen_at'
        ):
            story.velocity_score = compute_velocity(
                story.independent_count, story.first_seen_at
            )
            story.save(update_fields=['velocity_score'])

        # New reporting invalidates cached answers. A cached response about a
        # developing story is wrong the moment fresh coverage lands, and on a
        # news product a stale answer is worse than a slow one.
        if processed:
            from core.services.answer_cache import invalidate_all
            invalidate_all()

        # Backlog depth is the single best health signal here: an article that
        # is never clustered is invisible to every reader, and no request-level
        # metric would show it.
        articles_pending_clustering.set(
            Article.objects.filter(story__isnull=True).count()
        )

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


@shared_task(queue='celery', bind=True, max_retries=2, soft_time_limit=15)
def revalidate_frontend_story(self, slug: str):
    """
    Purge the Next.js cache for one story. Out-of-band so a slow or unreachable
    frontend can never stall ingestion or clustering.
    """
    from core.invalidation import revalidate_frontend
    if revalidate_frontend(slug):
        return f"Revalidated {slug}"
    return f"Revalidation skipped for {slug}"


@shared_task(queue='cluster', soft_time_limit=120)
def refresh_momentum_scores():
    """
    Recompute momentum and let it decay.

    Momentum falls as the window slides with no write to the story, so without
    this pass yesterday's news would stay pinned to the top of Developing.
    """
    from core.momentum import refresh_momentum
    return refresh_momentum()


@shared_task(queue='celery', soft_time_limit=600)
def apply_retention():
    """
    Release data past its useful life. See core/retention.py for the policy.

    Runs nightly, offset from the trust-graph job so two long-running
    maintenance tasks don't contend for the same worker.
    """
    from core.retention import run_retention
    return run_retention()


@shared_task(queue='celery')
def compute_trust_metrics():
    """Nightly task to update source trust and corroboration metrics."""
    from core.trust import compute_trust_graph
    compute_trust_graph()
    return "Trust metrics updated"


@shared_task(queue='celery', bind=True, max_retries=3)
def synthesize_story_brief(self, story_id: int):
    """
    Async task to synthesize multi-source intelligence brief for a Story cluster.
    Enforces Redis locking per story and daily spend budget circuit breaker.
    """
    import os
    lock_id = f"synthesis_lock:{story_id}"
    if not cache.add(lock_id, "locked", timeout=120):
        logger.info("Synthesis task for story %d is already running.", story_id)
        return "Locked"

    try:
        try:
            story = Story.objects.get(id=story_id)
        except Story.DoesNotExist:
            return "Story Not Found"

        # Daily budget check for background AI synthesis
        max_daily = int(os.environ.get("MAX_SYNTHESIS_DAILY_REQUESTS", 200))
        daily_key = f"ai_synthesis:daily_requests:{timezone.now().strftime('%Y-%m-%d')}"
        daily_count = cache.get(daily_key, 0)

        if daily_count >= max_daily:
            logger.warning("Daily AI synthesis budget quota (%d) reached. Skipping story %d.", max_daily, story_id)
            story.synthesis_status = Story.SynthesisStatus.FAILED
            story.save(update_fields=['synthesis_status'])
            return "Budget Ceiling Exceeded"

        story.synthesis_status = Story.SynthesisStatus.PENDING
        story.save(update_fields=['synthesis_status'])

        from core.services.synthesis import AISynthesisService
        service = AISynthesisService()
        result = service.synthesize_story(story)

        story.ai_summary = result
        story.synthesis_status = Story.SynthesisStatus.COMPLETED
        story.synthesized_at = timezone.now()
        story.synthesis_source_count = story.source_count
        # Recorded so the next cluster update can tell whether the corroboration
        # picture moved enough to justify regenerating the brief.
        story.synthesis_independent_count = story.independent_count
        if result.get("consensus_lead"):
            story.summary = result["consensus_lead"]
        story.save(update_fields=[
            'ai_summary', 'synthesis_status', 'synthesized_at',
            'synthesis_source_count', 'synthesis_independent_count', 'summary',
        ])

        # The brief is the main thing the story page shows — purge the cached
        # response so it doesn't lag behind by up to 5 minutes.
        from core.invalidation import invalidate_story
        invalidate_story(story.slug)

        # Increment daily counter
        if daily_count == 0:
            cache.set(daily_key, 1, timeout=86400)
        else:
            cache.incr(daily_key)

        logger.info("Successfully synthesized brief for story '%s' (%d sources).", story.slug, story.source_count)
        return f"Synthesized story {story_id}"
    except Exception as exc:
        logger.error("Synthesis task failed for story %d: %s", story_id, exc)
        try:
            story = Story.objects.get(id=story_id)
            story.synthesis_status = Story.SynthesisStatus.FAILED
            story.save(update_fields=['synthesis_status'])
        except Exception:
            pass
        raise self.retry(exc=exc, countdown=10) from exc
    finally:
        cache.delete(lock_id)
