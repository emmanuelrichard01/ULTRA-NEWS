import requests
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from .models import Article, Story

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Article)
def update_primary_source_on_article_save(sender, instance, created, **kwargs):
    if instance.story:
        instance.story.update_primary_source()

@receiver(post_save, sender=Story)
def trigger_nextjs_revalidate(sender, instance, **kwargs):
    """
    Fire a webhook to Next.js to revalidate the specific story cache tag.
    """
    nextjs_url = getattr(settings, 'NEXTJS_URL', 'http://frontend:3000')
    webhook_secret = getattr(settings, 'REVALIDATE_SECRET', 'dev_secret')
    
    url = f"{nextjs_url}/api/revalidate?tag=story:{instance.id}&secret={webhook_secret}"
    try:
        # Fire and forget (timeout=1 to prevent blocking)
        requests.get(url, timeout=1)
    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to trigger Next.js revalidation for story {instance.id}: {e}")
