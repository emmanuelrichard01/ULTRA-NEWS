import uuid
from django.utils.text import slugify
from django.core.management.base import BaseCommand
from core.models import Source, Article
from core.services.scraper import ScraperService

class Command(BaseCommand):
    help = 'Ingests news from all configured sources'

    def handle(self, *args, **options):
        self.stdout.write("Triggering background ingestion task...")
        from core.tasks import scrape_all_sources
        # Trigger the task asynchronously
        scrape_all_sources.delay()
        self.stdout.write(self.style.SUCCESS('Task triggered successfully! Check worker logs.'))
