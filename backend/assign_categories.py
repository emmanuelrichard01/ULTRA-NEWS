"""
Script to retroactively assign categories to existing articles.
Run inside Django shell: python manage.py shell < assign_categories.py
"""
from core.models import Article, Category

# Keyword mappings for auto-categorization
CATEGORY_KEYWORDS = {
    'tech': ['tech', 'software', 'hardware', 'ai', 'artificial intelligence', 'computer', 'startup', 'google', 'apple', 'microsoft', 'amazon', 'meta', 'coding', 'programming', 'developer', 'app', 'robot', 'machine learning', 'data', 'cyber', 'internet', 'digital', 'gadget', 'smartphone', 'iphone', 'android'],
    'politics': ['politics', 'government', 'election', 'congress', 'senate', 'president', 'democrat', 'republican', 'vote', 'policy', 'legislation', 'white house', 'parliament', 'minister', 'law', 'bill', 'campaign'],
    'business': ['business', 'economy', 'market', 'stock', 'finance', 'investment', 'bank', 'startup', 'ceo', 'company', 'earnings', 'revenue', 'profit', 'merger', 'acquisition', 'ipo', 'wall street', 'trade', 'entrepreneur'],
    'entertainment': ['entertainment', 'movie', 'film', 'music', 'celebrity', 'actor', 'singer', 'hollywood', 'streaming', 'netflix', 'disney', 'concert', 'album', 'tv show', 'series', 'award', 'grammy', 'oscar', 'emmys'],
    'science': ['science', 'research', 'study', 'scientist', 'discovery', 'space', 'nasa', 'climate', 'environment', 'biology', 'physics', 'chemistry', 'medical', 'health', 'vaccine', 'experiment', 'journal'],
    'art': ['art', 'artist', 'museum', 'gallery', 'painting', 'sculpture', 'exhibition', 'design', 'creative', 'culture', 'photography', 'architecture'],
}

def assign_categories_to_article(article):
    """Assign categories based on title and content."""
    text = f"{article.title} {article.content}".lower()
    matched_slugs = []
    
    for slug, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                matched_slugs.append(slug)
                break
    
    if matched_slugs:
        categories = Category.objects.filter(slug__in=matched_slugs)
        if categories.exists():
            article.categories.set(categories)
            return list(categories.values_list('slug', flat=True))
    return []

# Run assignment
print("Starting retroactive category assignment...")
articles = Article.objects.all()
total = articles.count()
assigned_count = 0

for i, article in enumerate(articles):
    categories = assign_categories_to_article(article)
    if categories:
        assigned_count += 1
    if (i + 1) % 50 == 0:
        print(f"Processed {i + 1}/{total} articles...")

print(f"\nDone! Assigned categories to {assigned_count} out of {total} articles.")
