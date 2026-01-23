"""Silent news ingestion - no output whatsoever for cron jobs."""
import sys
import os
import logging

# Disable ALL logging before any Django imports
logging.disable(logging.CRITICAL)
os.environ['PYTHONWARNINGS'] = 'ignore'

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Silently ingest news (for cron jobs)'

    def handle(self, *args, **options):
        # Redirect stdout/stderr to devnull for complete silence
        with open(os.devnull, 'w') as devnull:
            old_stdout, old_stderr = sys.stdout, sys.stderr
            sys.stdout = sys.stderr = devnull
            try:
                from core.tasks import scrape_all_sources
                scrape_all_sources()
            except Exception:
                pass  # Silently fail
            finally:
                sys.stdout, sys.stderr = old_stdout, old_stderr
