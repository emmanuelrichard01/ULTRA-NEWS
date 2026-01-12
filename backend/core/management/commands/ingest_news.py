from django.core.management.base import BaseCommand
from core.models import Source
from core.services.scraper import ScraperService

class Command(BaseCommand):
    help = 'Ingests news from all configured sources'

    def handle(self, *args, **options):
        self.stdout.write("Starting ingestion...")
        sources = Source.objects.all()
        service = ScraperService()

        for source in sources:
            self.stdout.write(f"Scraping {source.name}...")
            # logic to call service and save articles would go here
            articles = service.scrape_source(source)
            self.stdout.write(f"Found {len(articles)} articles.")
        
        self.stdout.write(self.style.SUCCESS('Ingestion complete'))
