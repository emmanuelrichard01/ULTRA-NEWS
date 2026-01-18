"""
Management command to run news ingestion synchronously.
Used by the trigger-ingest endpoint via subprocess for true process detachment.
"""
import logging
from django.core.management.base import BaseCommand
from core.tasks import scrape_all_sources

# Suppress all logging during ingestion to prevent output accumulation
logging.disable(logging.CRITICAL)


class Command(BaseCommand):
    help = 'Runs news ingestion synchronously (used by cron trigger endpoint)'

    def handle(self, *args, **options):
        # Run the scraping task directly (not async/delay)
        # All output is suppressed to prevent "output too large" errors
        try:
            scrape_all_sources()
        except Exception:
            pass  # Silently fail - we can't output anything
