"""
Data retention.

Measured footprint on a running instance: ~9.2 KB per article row (the 384-d
vector, the sanitised body, and the search_vector dominate) plus ~3.7 KB per
RawDocument. At roughly 1,000 articles a day from 41 sources that is about
3.3 GB/year of articles and 1.3 GB/year of raw text — enough to matter for a
project people self-host on a small VPS, and enough to degrade the HNSW index
long before the disk fills.

The policy is tiered rather than a single delete horizon, because the parts of a
row have very different useful lifetimes:

  RawDocument     Full extracted text. Only ever needed to compute an embedding
                  and to write a synthesis brief, both of which happen within
                  hours of ingest. Never shown to a reader. Shortest life, and
                  the cheapest large win.

  Article.content Sanitised body HTML. Same story: we display `excerpt`, not
                  this. Cleared rather than deleted so the row survives.

  Article.embedding
                  Clustering only ever compares against the last 7 days, and
                  question answering should favour recent news. Vectors on
                  months-old articles are pure index weight. Cleared, not
                  deleted — the article stays readable and linkable.

  Story           Kept. Stories are the product's memory and are small; a story
                  row without article vectors still renders completely.

  Uncorroborated  Single-source stories that never attracted a second outlet
                  after the corroboration window are noise, and they are the
                  bulk of the archive (~95% of rows). These are the only thing
                  deleted outright, and only once they are old enough that a
                  late pickup is implausible.

Everything is configurable, and the defaults are deliberately conservative: an
operator who wants a permanent archive sets RETENTION_ENABLED=0 and keeps
everything.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


def _days(name: str, default: int) -> int:
    return int(getattr(settings, name, default))


def purge_raw_documents(dry_run: bool = False) -> int:
    """Drop full extracted text past its useful life."""
    from core.models import RawDocument

    cutoff = timezone.now() - timedelta(days=_days("RETENTION_RAW_DOCUMENT_DAYS", 14))
    qs = RawDocument.objects.filter(fetched_at__lt=cutoff)
    count = qs.count()
    if count and not dry_run:
        # Bounded deletes so a first run on a large archive doesn't hold one
        # enormous transaction open.
        while True:
            ids = list(qs.values_list("pk", flat=True)[:5000])
            if not ids:
                break
            RawDocument.objects.filter(pk__in=ids).delete()
    return count


def clear_stale_article_payloads(dry_run: bool = False) -> int:
    """
    Blank body text and embeddings on old articles, keeping the row.

    The article stays listed, linkable and searchable — only the parts nothing
    reads any more are released.
    """
    from core.models import Article

    cutoff = timezone.now() - timedelta(days=_days("RETENTION_ARTICLE_PAYLOAD_DAYS", 45))
    qs = Article.objects.filter(published_date__lt=cutoff).filter(
        Q(embedding__isnull=False) | ~Q(content="")
    )
    count = qs.count()
    if count and not dry_run:
        qs.update(embedding=None, content="")
    return count


def delete_uncorroborated_stories(dry_run: bool = False) -> int:
    """
    Remove old single-source stories that never gained a second outlet.

    This is the only destructive step, and it targets the ~95% of rows that are
    a lone report nobody else picked up. A story that reached two independent
    outlets is kept regardless of age — that is the archive worth having.
    """
    from core.models import Article, Story

    days = _days("RETENTION_UNCORROBORATED_STORY_DAYS", 90)
    if days <= 0:
        return 0

    cutoff = timezone.now() - timedelta(days=days)
    qs = Story.objects.filter(first_seen_at__lt=cutoff, independent_count__lte=1)
    count = qs.count()

    if count and not dry_run:
        while True:
            ids = list(qs.values_list("pk", flat=True)[:2000])
            if not ids:
                break
            # Articles cascade to SET_NULL on story delete, which would strand
            # them as permanently unclustered. Remove them with their story.
            Article.objects.filter(story_id__in=ids).delete()
            Story.objects.filter(pk__in=ids).delete()

    return count


def run_retention(dry_run: bool = False) -> dict:
    """Apply every retention rule. Returns what was (or would be) affected."""
    if not getattr(settings, "RETENTION_ENABLED", True):
        logger.info("Retention disabled; keeping everything.")
        return {"enabled": False}

    result = {
        "enabled": True,
        "dry_run": dry_run,
        "raw_documents_purged": purge_raw_documents(dry_run),
        "article_payloads_cleared": clear_stale_article_payloads(dry_run),
        "uncorroborated_stories_deleted": delete_uncorroborated_stories(dry_run),
    }
    logger.info("Retention pass: %s", result)
    return result


def archive_stats() -> dict:
    """Current archive shape, for the retention command and monitoring."""
    from core.models import Article, RawDocument, Story

    now = timezone.now()
    return {
        "articles": Article.objects.count(),
        "articles_with_embedding": Article.objects.filter(embedding__isnull=False).count(),
        "raw_documents": RawDocument.objects.count(),
        "stories": Story.objects.count(),
        "stories_corroborated": Story.objects.filter(independent_count__gte=2).count(),
        "oldest_article": Article.objects.order_by("published_date")
        .values_list("published_date", flat=True)
        .first(),
        "articles_last_24h": Article.objects.filter(
            created_at__gte=now - timedelta(days=1)
        ).count(),
    }
