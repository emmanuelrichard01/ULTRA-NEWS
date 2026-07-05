from django.db.models import Count, F
from django.utils import timezone
import logging

from core.models import Source, Story, Article

logger = logging.getLogger(__name__)

def compute_trust_graph():
    """
    Computes the Trust Graph for all sources.
    This replaces the static trust tiers with evidence-based reputation.
    """
    logger.info("Computing trust graph...")
    sources = Source.objects.all()
    
    # Pre-calculate story status map
    corroborated_stories = Story.objects.filter(status=Story.Status.CORROBORATED).values_list('id', flat=True)
    corroborated_set = set(corroborated_stories)
    
    for source in sources:
        articles = source.articles.all()
        total_articles = articles.count()
        if total_articles == 0:
            continue
            
        corroborated_count = 0
        broken_first_count = 0
        
        for article in articles:
            if article.story_id in corroborated_set:
                corroborated_count += 1
                if article.is_primary_source:
                    broken_first_count += 1
                    
        # Calculate corroboration rate
        rate = (corroborated_count / total_articles) * 100.0
        
        source.corroboration_rate = rate
        source.articles_broken_first = broken_first_count
        source.save(update_fields=['corroboration_rate', 'articles_broken_first'])
        
    logger.info("Trust graph computation complete.")
