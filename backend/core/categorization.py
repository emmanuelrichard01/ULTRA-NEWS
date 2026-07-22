"""
Centralized categorization logic for ULTRA-NEWS.

Single source of truth for keyword-based article categorization.
Import this module wherever categorization is needed — never duplicate these mappings.

V3.1: Word-boundary regex matching + scoring threshold to eliminate false positives.
"""
import re
import logging
from typing import List, Tuple

from core.models import Category

logger = logging.getLogger(__name__)

# Maximum categories per article — prevents over-tagging
MAX_CATEGORIES_PER_ARTICLE = 3

# Minimum keyword hits required to assign a category
MIN_HITS_THRESHOLD = 2

# Keyword mappings for auto-categorization.
# Keys are category slugs matching the Category.slug field in the database.
# Values are lists of keywords — matched via word boundaries (\b) to prevent
# substring false positives (e.g., "art" in "apartment").
# Overly generic words have been removed to reduce noise.
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    'tech': [
        'software', 'hardware', 'artificial intelligence',
        'computer', 'startup', 'google', 'apple', 'microsoft',
        'meta', 'coding', 'programming', 'developer', 'robot',
        'machine learning', 'cyber', 'internet', 'digital',
        'gadget', 'smartphone', 'iphone', 'android', 'semiconductor',
        'openai', 'chatgpt', 'autonomous', 'cloud computing',
        'silicon valley', 'algorithm', 'blockchain', 'cryptocurrency',
        'nvidia', 'tesla', 'spacex', 'deepmind', 'generative ai',
    ],
    'politics': [
        'election', 'congress', 'senate',
        'president', 'democrat', 'republican', 'vote', 'policy',
        'legislation', 'white house', 'parliament', 'prime minister',
        'political', 'governor', 'mayor', 'cabinet', 'opposition',
        'referendum', 'impeach', 'bipartisan', 'gerrymander',
        'constituency', 'ballot', 'campaign', 'diplomatic',
    ],
    'business': [
        'economy', 'stock market', 'finance', 'investment',
        'startup', 'ceo', 'earnings', 'revenue',
        'profit', 'merger', 'acquisition', 'ipo', 'wall street',
        'entrepreneur', 'gdp', 'inflation', 'recession',
        'interest rate', 'federal reserve', 'central bank',
        'quarterly results', 'shareholder', 'valuation',
    ],
    'entertainment': [
        'movie', 'film', 'celebrity', 'actor',
        'singer', 'hollywood', 'streaming', 'netflix', 'disney',
        'album', 'tv show', 'grammy', 'oscar', 'emmys',
        'box office', 'premiere', 'blockbuster', 'sitcom',
        'standup', 'comedian', 'marvel', 'studio',
    ],
    'science': [
        'research', 'scientist', 'discovery', 'space',
        'nasa', 'climate change', 'biology', 'physics', 'chemistry',
        'experiment', 'astronomy', 'quantum',
        'evolution', 'genome', 'species', 'fossil',
        'laboratory', 'peer-reviewed', 'telescope', 'mars',
        'particle', 'renewable energy', 'carbon emission',
    ],
    'art': [
        'museum', 'gallery', 'painting', 'sculpture',
        'exhibition', 'photography', 'architecture',
        'contemporary art', 'visual art', 'installation',
        'curator', 'mural', 'canvas', 'portrait', 'auction house',
    ],
    'sports': [
        'football', 'soccer', 'nba', 'nfl', 'olympics', 'world cup',
        'tennis', 'formula 1', 'cricket', 'premier league',
        'champions league', 'basketball', 'baseball', 'rugby',
        'athletics', 'tournament', 'stadium', 'coach',
        'transfer', 'fifa', 'uefa', 'la liga', 'serie a',
        'hat trick', 'penalty', 'goalkeeper', 'midfielder',
        'semifinal', 'semi-final', 'quarterfinal', 'quarter-final',
    ],
    'health': [
        'hospital', 'pandemic', 'disease', 'fda',
        'clinical trial', 'vaccine', 'mental health', 'healthcare',
        'patient', 'diagnosis', 'treatment', 'surgery', 'cancer',
        'diabetes', 'outbreak', 'virus', 'public health', 'medicine',
        'pharmaceutical', 'therapy', 'wellness', 'epidemic',
        'mortality', 'chronic', 'symptoms', 'prescription',
    ],
    'world': [
        'united nations', 'nato', 'summit', 'diplomacy',
        'conflict', 'refugee', 'sanctions', 'treaty', 'peacekeeping',
        'embassy', 'foreign policy', 'geopolitical', 'humanitarian',
        'migration', 'sovereignty', 'ceasefire',
        'g7', 'g20', 'security council', 'international',
        'territorial', 'airstrikes', 'occupied', 'annexation',
    ],
}

# Precompile regex patterns for performance — each keyword gets \b word boundaries
_COMPILED_PATTERNS: dict[str, list[re.Pattern]] = {}

def _get_compiled_patterns() -> dict[str, list[re.Pattern]]:
    """Lazily compile and cache word-boundary regex patterns."""
    if not _COMPILED_PATTERNS:
        for slug, keywords in CATEGORY_KEYWORDS.items():
            _COMPILED_PATTERNS[slug] = [
                re.compile(r'\b' + re.escape(kw) + r'\b', re.IGNORECASE)
                for kw in keywords
            ]
    return _COMPILED_PATTERNS


# All category names used during seeding, keyed by slug
CATEGORY_REGISTRY: dict[str, str] = {
    'tech': 'Tech',
    'politics': 'Politics',
    'business': 'Business',
    'entertainment': 'Entertainment',
    'science': 'Science',
    'art': 'Art',
    'sports': 'Sports',
    'health': 'Health',
    'world': 'World',
}


def match_category_slugs(title: str, content: str) -> List[Tuple[str, int]]:
    """
    Return a list of (category_slug, hit_count) tuples that meet the threshold.
    Sorted by hit count descending. Pure logic — no database access.
    """
    text = f"{title} {content}"
    patterns = _get_compiled_patterns()
    scored: list[Tuple[str, int]] = []

    for slug, slug_patterns in patterns.items():
        hits = 0
        for pattern in slug_patterns:
            if pattern.search(text):
                hits += 1
        if hits >= MIN_HITS_THRESHOLD:
            scored.append((slug, hits))

    # Sort by score descending, then limit
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:MAX_CATEGORIES_PER_ARTICLE]


def assign_categories_to_article(article, title: str, content: str) -> List[str]:
    """
    Automatically assign categories to an article based on keyword matching.
    Returns the list of assigned category slugs.
    """
    scored_slugs = match_category_slugs(title, content)

    if scored_slugs:
        slugs = [s[0] for s in scored_slugs]
        categories = Category.objects.filter(slug__in=slugs)
        if categories.exists():
            article.categories.set(categories)
            assigned = list(categories.values_list('slug', flat=True))
            logger.info(
                "Assigned categories %s to article: %s",
                assigned,
                title[:50],
            )
            return assigned

    return []


def seed_all_categories() -> list[tuple[str, bool]]:
    """
    Ensure all categories exist in the database. Returns list of (name, created) tuples.
    Idempotent — safe to call repeatedly.
    """
    results = []
    for slug, name in CATEGORY_REGISTRY.items():
        _, created = Category.objects.get_or_create(name=name, slug=slug)
        results.append((name, created))
    return results
