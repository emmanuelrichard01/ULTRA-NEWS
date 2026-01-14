import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Source

SOURCES = [
    {
        "name": "The Verge",
        "url": "https://www.theverge.com/rss/index.xml",
        "scraper_type": "rss"
    },
    {
        "name": "Wired",
        "url": "https://www.wired.com/feed/rss",
        "scraper_type": "rss"
    },
    {
        "name": "BBC News",
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "scraper_type": "rss"
    },
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
        "scraper_type": "rss"
    },
    {
        "name": "Ars Technica",
        "url": "https://arstechnica.com/feed/",
        "scraper_type": "rss"
    },
    {
        "name": "NYT Technology",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
        "scraper_type": "rss"
    }
]

created_count = 0
for s in SOURCES:
    obj, created = Source.objects.get_or_create(
        url=s["url"],
        defaults={
            "name": s["name"],
            "scraper_type": s["scraper_type"]
        }
    )
    if created:
        print(f"Created source: {s['name']}")
        created_count += 1
    else:
        print(f"Source already exists: {s['name']}")

print(f"Finished. Standardized {created_count} new sources.")
