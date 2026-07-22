from django.core.management.base import BaseCommand
from core.models import Article, Story
from core.categorization import assign_categories_to_article


class Command(BaseCommand):
    help = 'Re-categorize all existing articles with the improved categorization system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview category changes without applying them.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        articles = Article.objects.all().order_by('id')
        total = articles.count()

        self.stdout.write(f"Re-categorizing {total} articles...")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no changes will be saved."))

        stats = {
            'recategorized': 0,
            'no_match': 0,
        }
        category_counts: dict[str, int] = {}

        for i, article in enumerate(articles.iterator(), 1):
            if dry_run:
                from core.categorization import match_category_slugs
                scored = match_category_slugs(article.title, article.content)
                slugs = [s[0] for s in scored]
            else:
                slugs = assign_categories_to_article(
                    article, article.title, article.content
                )

            if slugs:
                stats['recategorized'] += 1
                for s in slugs:
                    category_counts[s] = category_counts.get(s, 0) + 1
            else:
                stats['no_match'] += 1

            if i % 100 == 0:
                self.stdout.write(f"  Processed {i}/{total}...")

        # Now update story categories based on their articles
        if not dry_run:
            stories = Story.objects.all()
            story_count = stories.count()
            self.stdout.write(f"\nUpdating categories for {story_count} stories...")
            for story in stories:
                # Collect all unique category IDs from the story's articles
                cat_ids = set()
                for art in story.articles.prefetch_related('categories').all():
                    cat_ids.update(art.categories.values_list('id', flat=True))
                story.categories.set(cat_ids)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Done! Recategorized: {stats['recategorized']}, No match: {stats['no_match']}"))
        self.stdout.write("")
        self.stdout.write("Category distribution:")
        for slug, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            pct = (count / total) * 100
            bar = '█' * int(pct / 2)
            self.stdout.write(f"  {slug:15s} {count:5d} ({pct:5.1f}%) {bar}")
