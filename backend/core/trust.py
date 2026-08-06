import logging

from django.db.models import Count, Q

from core.models import Source, Story

logger = logging.getLogger(__name__)


def compute_trust_graph():
    """
    Compute the Trust Graph for all sources — evidence-based reputation rather
    than static tiers.

    Two metrics per source:
      corroboration_rate    % of its articles that landed in a Corroborated story
      articles_broken_first # of Corroborated stories where it reported first

    Aggregated in the database. The previous version looped every Source, pulled
    every one of its Articles into Python, and counted in a for-loop — so the
    nightly task's memory and query cost grew linearly with the entire archive.
    """
    logger.info("Computing trust graph...")

    corroborated = Q(articles__story__status=Story.Status.CORROBORATED)

    sources = Source.objects.annotate(
        total_articles=Count('articles', distinct=True),
        corroborated_articles=Count('articles', filter=corroborated, distinct=True),
        broken_first=Count(
            'articles',
            filter=corroborated & Q(articles__is_primary_source=True),
            distinct=True,
        ),
    ).only('id', 'corroboration_rate', 'articles_broken_first')

    to_update = []
    for source in sources:
        if not source.total_articles:
            continue
        source.corroboration_rate = (
            source.corroborated_articles / source.total_articles
        ) * 100.0
        source.articles_broken_first = source.broken_first
        to_update.append(source)

    if to_update:
        Source.objects.bulk_update(
            to_update, ['corroboration_rate', 'articles_broken_first'], batch_size=200
        )

    logger.info("Trust graph computation complete for %d sources.", len(to_update))
