"""
Centralized categorization logic for ULTRA-NEWS.

Single source of truth for keyword-based article categorization.
Import this module wherever categorization is needed — never duplicate these mappings.
"""
import logging
from typing import List

from core.models import Category

logger = logging.getLogger(__name__)

# Keyword mappings for auto-categorization.
# Keys are category slugs matching the Category.slug field in the database.
# Values are lists of keywords — if ANY keyword appears in the article's
# title+content text, that category is assigned.
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    'tech': [
        'tech', 'software', 'hardware', 'ai', 'artificial intelligence',
        'computer', 'startup', 'google', 'apple', 'microsoft', 'amazon',
        'meta', 'coding', 'programming', 'developer', 'app', 'robot',
        'machine learning', 'data', 'cyber', 'internet', 'digital',
        'gadget', 'smartphone', 'iphone', 'android',
    ],
    'politics': [
        'politics', 'government', 'election', 'congress', 'senate',
        'president', 'democrat', 'republican', 'vote', 'policy',
        'legislation', 'white house', 'parliament', 'minister', 'law',
        'bill', 'campaign',
    ],
    'business': [
        'business', 'economy', 'market', 'stock', 'finance', 'investment',
        'bank', 'startup', 'ceo', 'company', 'earnings', 'revenue',
        'profit', 'merger', 'acquisition', 'ipo', 'wall street', 'trade',
        'entrepreneur',
    ],
    'entertainment': [
        'entertainment', 'movie', 'film', 'music', 'celebrity', 'actor',
        'singer', 'hollywood', 'streaming', 'netflix', 'disney', 'concert',
        'album', 'tv show', 'series', 'award', 'grammy', 'oscar', 'emmys',
    ],
    'science': [
        'science', 'research', 'study', 'scientist', 'discovery', 'space',
        'nasa', 'climate', 'environment', 'biology', 'physics', 'chemistry',
        'medical', 'health', 'vaccine', 'experiment', 'journal',
    ],
    'art': [
        'art', 'artist', 'museum', 'gallery', 'painting', 'sculpture',
        'exhibition', 'design', 'creative', 'culture', 'photography',
        'architecture',
    ],
}

# All category names used during seeding, keyed by slug
CATEGORY_REGISTRY: dict[str, str] = {
    'tech': 'Tech',
    'politics': 'Politics',
    'business': 'Business',
    'entertainment': 'Entertainment',
    'science': 'Science',
    'art': 'Art',
}


def match_category_slugs(title: str, content: str) -> List[str]:
    """
    Return a list of category slugs that match the given title and content.
    Pure logic — no database access.
    """
    text = f"{title} {content}".lower()
    matched = []

    for slug, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                matched.append(slug)
                break  # One match per category is enough

    return matched


def assign_categories_to_article(article, title: str, content: str) -> List[str]:
    """
    Automatically assign categories to an article based on keyword matching.
    Returns the list of assigned category slugs.
    """
    matched_slugs = match_category_slugs(title, content)

    if matched_slugs:
        categories = Category.objects.filter(slug__in=matched_slugs)
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
