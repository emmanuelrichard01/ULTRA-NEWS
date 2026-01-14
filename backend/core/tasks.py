import uuid
import logging
from celery import shared_task
from django.utils.text import slugify
from core.models import Source, Article, Category
from core.services.scraper import ScraperService

logger = logging.getLogger(__name__)

# Keyword mappings for auto-categorization
CATEGORY_KEYWORDS = {
    'tech': ['tech', 'software', 'hardware', 'ai', 'artificial intelligence', 'computer', 'startup', 'google', 'apple', 'microsoft', 'amazon', 'meta', 'coding', 'programming', 'developer', 'app', 'robot', 'machine learning', 'data', 'cyber', 'internet', 'digital', 'gadget', 'smartphone', 'iphone', 'android'],
    'politics': ['politics', 'government', 'election', 'congress', 'senate', 'president', 'democrat', 'republican', 'vote', 'policy', 'legislation', 'white house', 'parliament', 'minister', 'law', 'bill', 'campaign'],
    'business': ['business', 'economy', 'market', 'stock', 'finance', 'investment', 'bank', 'startup', 'ceo', 'company', 'earnings', 'revenue', 'profit', 'merger', 'acquisition', 'ipo', 'wall street', 'trade', 'entrepreneur'],
    'entertainment': ['entertainment', 'movie', 'film', 'music', 'celebrity', 'actor', 'singer', 'hollywood', 'streaming', 'netflix', 'disney', 'concert', 'album', 'tv show', 'series', 'award', 'grammy', 'oscar', 'emmys'],
    'science': ['science', 'research', 'study', 'scientist', 'discovery', 'space', 'nasa', 'climate', 'environment', 'biology', 'physics', 'chemistry', 'medical', 'health', 'vaccine', 'experiment', 'journal'],
    'art': ['art', 'artist', 'museum', 'gallery', 'painting', 'sculpture', 'exhibition', 'design', 'creative', 'culture', 'photography', 'architecture'],
}

def assign_categories(article, title: str, content: str):
    """
    Automatically assign categories to an article based on keyword matching.
    """
    text = f"{title} {content}".lower()
    matched_slugs = []
    
    for slug, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                matched_slugs.append(slug)
                break  # One match per category is enough
    
    if matched_slugs:
        categories = Category.objects.filter(slug__in=matched_slugs)
        if categories.exists():
            article.categories.set(categories)
            logger.info(f"Assigned categories {list(categories.values_list('slug', flat=True))} to article: {title[:50]}")

@shared_task
def scrape_all_sources():
    """
    Background task to scrape all configured news sources.
    """
    logger.info("Starting background scraping task...")
    sources = Source.objects.all()
    service = ScraperService()
    
    total_new = 0
    
    for source in sources:
        logger.info(f"Scraping {source.name}...")
        try:
            articles_data = service.scrape_source(source)
            count = 0
            for data in articles_data:
                if not Article.objects.filter(url=data['url']).exists():
                    slug = slugify(data['title'])
                    if Article.objects.filter(slug=slug).exists():
                         slug = f"{slug}-{uuid.uuid4().hex[:6]}"
                    
                    article = Article.objects.create(
                        source=source,
                        title=data['title'],
                        url=data['url'],
                        content=data['content'],
                        published_date=data['published_date'],
                        image_url=data.get('image_url'),  # FIX: Save image_url
                        slug=slug
                    )
                    
                    # Auto-assign categories based on content
                    assign_categories(article, data['title'], data['content'])
                    
                    count += 1
            logger.info(f"Saved {count} new articles for {source.name}")
            total_new += count
        except Exception as e:
            logger.error(f"Failed to scrape {source.name}: {str(e)}")
            
    logger.info(f"Scraping complete. Total new articles: {total_new}")
    return f"Scraped {total_new} articles"
