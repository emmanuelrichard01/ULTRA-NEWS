import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Article, Story
from django.utils.text import slugify

def run():
    print("Clustering existing articles into stories...")
    articles = Article.objects.filter(story__isnull=True).order_by('-published_date')
    count = 0
    for article in articles:
        # Simple stopgap: 1 Article = 1 Story for now just to populate the DB
        # If there's an exact title match, group it.
        story = Story.objects.filter(title=article.title).first()
        if not story:
            slug = slugify(article.title)[:200]
            if not slug:
                slug = f"story-{article.id}"
            
            # Handle slug collision
            base_slug = slug
            counter = 1
            while Story.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            story = Story.objects.create(
                title=article.title,
                slug=slug,
                summary=article.excerpt,
                first_seen_at=article.published_date,
                source_count=1,
                velocity_score=1.0,
            )
            # copy categories
            story.categories.set(article.categories.all())
        else:
            story.source_count += 1
            story.save()

        article.story = story
        article.save()
        count += 1
        
    print(f"Created/updated stories for {count} articles.")

if __name__ == '__main__':
    run()
