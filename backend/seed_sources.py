import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Source

SOURCES = [
    # News Sources
    {
        "name": "Premium Times",
        "url": "https://premiumtimesng.com/feed",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "BusinessDay",
        "url": "https://businessday.ng/feed",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "Nairametrics",
        "url": "https://nairametrics.com/feed/",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "TechCabal",
        "url": "https://techcabal.com/feed/",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "Punch",
        "url": "https://rss.punchng.com/v1/category/latest_news",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "Channels TV",
        "url": "https://www.channelstv.com/feed/",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "AllAfrica",
        "url": "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf",
        "scraper_type": "rss",
        "source_type": "news"
    },
    # Primary Sources
    {
        "name": "Central Bank of Nigeria (CBN)",
        "url": "https://www.cbn.gov.ng/rss/rss.xml", # Assuming an endpoint or sitemap
        "scraper_type": "rss",
        "source_type": "primary"
    },
    {
        "name": "SEC Nigeria",
        "url": "https://sec.gov.ng/feed/",
        "scraper_type": "rss",
        "source_type": "primary"
    },
    {
        "name": "The Verge",
        "url": "https://www.theverge.com/rss/index.xml",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "Wired",
        "url": "https://www.wired.com/feed/rss",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "BBC News",
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "Ars Technica",
        "url": "https://arstechnica.com/feed/",
        "scraper_type": "rss",
        "source_type": "news"
    },
    {
        "name": "NYT Technology",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
        "scraper_type": "rss",
        "source_type": "news"
    }
]

created_count = 0
for s in SOURCES:
    obj, created = Source.objects.get_or_create(
        url=s["url"],
        defaults={
            "name": s["name"],
            "scraper_type": s["scraper_type"],
            "source_type": s["source_type"],
            "is_active": True
        }
    )
    if not created:
        # Update source type if it changed
        needs_save = False
        if obj.source_type != s["source_type"]:
            obj.source_type = s["source_type"]
            needs_save = True
        if not obj.is_active:
            obj.is_active = True
            needs_save = True
        
        if needs_save:
            obj.save(update_fields=['source_type', 'is_active'])
    else:
        print(f"Created source: {s['name']}")
        created_count += 1

print(f"Finished. Standardized {created_count} new sources.")
