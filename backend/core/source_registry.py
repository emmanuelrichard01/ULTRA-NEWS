"""
ULTRA-NEWS V3 — Source Registry

Single source of truth for all news sources.
Imported by api.py (seed_db endpoint) for database seeding.

Sources are organized into tiers based on their role in the
clustering pipeline:

  Tier 1 (Wire Services):  Highest cross-outlet overlap. AP and Reuters
                           text gets syndicated everywhere — these are
                           the seeds that make clustering work.

  Tier 2 (Major Global):   High-volume general-interest outlets that
                           cover the same breaking events as wire services.
                           These are the sources most likely to produce
                           multi-source corroborated stories.

  Tier 3 (Specialist):     Tech, business, science, and domain-specific
                           outlets. Lower cross-outlet overlap but high
                           value within their domain.

  Tier 4 (Regional):       Regional outlets. Lower clustering probability
                           but important for geographic diversity.

Each source dict includes:
  - name:         Display name
  - url:          RSS feed URL
  - scraper_type: Parser type (currently only 'rss')
  - source_type:  'news' or 'primary' (gov/corporate)
  - tier:         1-4 (wire/major/specialist/regional)
  - region:       Geographic region for diversity tracking
"""

SOURCES = [
    # =========================================================================
    # TIER 1 — Wire Services (highest clustering overlap)
    #
    # Wire services are the backbone of global news. Their copy gets
    # syndicated to hundreds of outlets, making them the ideal "seed"
    # for story clustering. When Reuters reports something, 10 other
    # outlets will publish versions within hours.
    # =========================================================================
    {
        "name": "Reuters",
        "url": "https://www.reutersagency.com/feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 1,
        "region": "global",
    },
    {
        "name": "AP News",
        "url": "https://rsshub.app/apnews/topics/apf-topnews",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 1,
        "region": "global",
    },
    {
        "name": "AFP (France)",
        "url": "https://www.france24.com/en/rss",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 1,
        "region": "europe",
    },

    # =========================================================================
    # TIER 2 — Major Global Outlets
    #
    # High-volume general-interest outlets. These cover the same breaking
    # events as wire services from different editorial angles. This tier
    # is critical for producing DEVELOPING (2 sources) and CORROBORATED
    # (3+ sources) stories.
    # =========================================================================
    {
        "name": "BBC News",
        "url": "https://feeds.bbci.co.uk/news/rss.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "europe",
    },
    {
        "name": "BBC World",
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "europe",
    },
    {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/world/rss",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "europe",
    },
    {
        "name": "Al Jazeera English",
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "middle-east",
    },
    {
        "name": "NPR News",
        "url": "https://feeds.npr.org/1001/rss.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "americas",
    },
    {
        "name": "CNN",
        "url": "http://rss.cnn.com/rss/edition.rss",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "americas",
    },
    {
        "name": "ABC News",
        "url": "https://abcnews.go.com/abcnews/topstories",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "americas",
    },
    {
        "name": "DW News",
        "url": "https://rss.dw.com/rdf/rss-en-all",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "europe",
    },
    {
        "name": "Sky News",
        "url": "https://feeds.skynews.com/feeds/rss/world.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "europe",
    },
    {
        "name": "NYT World",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "americas",
    },
    {
        "name": "NYT Homepage",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "americas",
    },
    {
        "name": "Washington Post World",
        "url": "https://feeds.washingtonpost.com/rss/world",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "americas",
    },
    {
        "name": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "americas",
    },
    {
        "name": "India Today",
        "url": "https://www.indiatoday.in/rss/home",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "asia",
    },
    {
        "name": "South China Morning Post",
        "url": "https://www.scmp.com/rss/91/feed",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "asia",
    },
    {
        "name": "The Japan Times",
        "url": "https://www.japantimes.co.jp/feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 2,
        "region": "asia",
    },

    # =========================================================================
    # TIER 3 — Specialist (Tech, Business, Science)
    #
    # Domain-specific outlets with deep coverage in their vertical.
    # Lower cross-outlet overlap but essential for category-filtered
    # feeds (Topics → Tech, Science, etc.).
    # =========================================================================
    {
        "name": "The Verge",
        "url": "https://www.theverge.com/rss/index.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "americas",
    },
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "americas",
    },
    {
        "name": "Ars Technica",
        "url": "https://arstechnica.com/feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "americas",
    },
    {
        "name": "Wired",
        "url": "https://www.wired.com/feed/rss",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "americas",
    },
    {
        "name": "NYT Technology",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "americas",
    },
    {
        "name": "The Economist",
        "url": "https://www.economist.com/international/rss.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "europe",
    },
    {
        "name": "Nature News",
        "url": "https://www.nature.com/nature.rss",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "europe",
    },
    {
        "name": "MIT Technology Review",
        "url": "https://www.technologyreview.com/feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "americas",
    },
    {
        "name": "Science Daily",
        "url": "https://www.sciencedaily.com/rss/all.xml",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "americas",
    },
    {
        "name": "Phys.org",
        "url": "https://phys.org/rss-feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 3,
        "region": "global",
    },

    # =========================================================================
    # TIER 4 — Regional (African / Emerging Markets)
    #
    # Regional outlets. Lower clustering probability with global sources
    # but important for geographic diversity and local coverage.
    # Permanently broken feeds (AllAfrica RDF, CBN RSS, SEC Nigeria)
    # have been removed.
    # =========================================================================
    {
        "name": "Premium Times",
        "url": "https://premiumtimesng.com/feed",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 4,
        "region": "africa",
    },
    {
        "name": "Punch",
        "url": "https://rss.punchng.com/v1/category/latest_news",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 4,
        "region": "africa",
    },
    {
        "name": "TechCabal",
        "url": "https://techcabal.com/feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 4,
        "region": "africa",
    },
    {
        "name": "News24",
        "url": "https://feeds.news24.com/articles/news24/TopStories/rss",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 4,
        "region": "africa",
    },
    {
        "name": "Daily Trust",
        "url": "https://dailytrust.com/feed/",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 4,
        "region": "africa",
    },
    {
        "name": "The EastAfrican",
        "url": "https://www.theeastafrican.co.ke/tea/news/rss",
        "scraper_type": "rss",
        "source_type": "news",
        "tier": 4,
        "region": "africa",
    },
]

# =========================================================================
# Registry Helpers
# =========================================================================

def get_sources_by_tier(tier: int) -> list:
    """Return sources filtered by tier number (1-4)."""
    return [s for s in SOURCES if s.get("tier") == tier]

def get_sources_by_region(region: str) -> list:
    """Return sources filtered by region."""
    return [s for s in SOURCES if s.get("region") == region]

TIER_LABELS = {
    1: "Wire Services",
    2: "Major Global",
    3: "Specialist",
    4: "Regional",
}

REGION_LABELS = {
    "global": "Global",
    "americas": "Americas",
    "europe": "Europe",
    "africa": "Africa",
    "asia": "Asia",
    "middle-east": "Middle East",
}
