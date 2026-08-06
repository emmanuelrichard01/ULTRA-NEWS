"""
Re-clean stored titles, excerpts and story summaries.

Text was previously extracted by deleting HTML tags rather than replacing them
with whitespace, which welded words across block boundaries — a story summary
read "…Russia says Published August 4, 2026 last updated August 4, 2026 What you
need to know". Publisher page furniture was not stripped either.

The scraper no longer produces this, but rows written before the fix still carry
it, and those excerpts are also what got embedded. Run once after deploying:

    python manage.py reclean_text            # report only
    python manage.py reclean_text --apply    # write the cleaned text back
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Article, Story
from core.services.scraper import clean_title, strip_boilerplate, strip_to_text


class Command(BaseCommand):
    help = "Re-clean article titles/excerpts and story summaries written before the extraction fix."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Persist changes.")
        parser.add_argument("--batch", type=int, default=500)

    def handle(self, *args, **opts):
        apply_changes = opts["apply"]
        changed_articles = 0
        samples = []

        articles = Article.objects.only("id", "title", "excerpt").iterator(
            chunk_size=opts["batch"]
        )
        pending = []

        for article in articles:
            new_title = clean_title(article.title)
            new_excerpt = strip_boilerplate(strip_to_text(article.excerpt))

            if new_title == article.title and new_excerpt == article.excerpt:
                continue

            if len(samples) < 5:
                samples.append((article.excerpt[:90], new_excerpt[:90]))

            article.title = new_title or article.title
            article.excerpt = new_excerpt
            pending.append(article)
            changed_articles += 1

            if apply_changes and len(pending) >= opts["batch"]:
                Article.objects.bulk_update(pending, ["title", "excerpt"])
                pending = []

        if apply_changes and pending:
            Article.objects.bulk_update(pending, ["title", "excerpt"])

        # Story summaries are copied from excerpts (or written by synthesis), so
        # they inherited the same corruption.
        changed_stories = 0
        story_pending = []
        for story in Story.objects.only("id", "title", "summary").iterator(
            chunk_size=opts["batch"]
        ):
            new_title = clean_title(story.title)
            new_summary = strip_boilerplate(strip_to_text(story.summary))
            if new_title == story.title and new_summary == story.summary:
                continue
            story.title = new_title or story.title
            story.summary = new_summary
            story_pending.append(story)
            changed_stories += 1

            if apply_changes and len(story_pending) >= opts["batch"]:
                Story.objects.bulk_update(story_pending, ["title", "summary"])
                story_pending = []

        if apply_changes and story_pending:
            with transaction.atomic():
                Story.objects.bulk_update(story_pending, ["title", "summary"])

        for before, after in samples:
            self.stdout.write(self.style.WARNING(f"  before: {before}"))
            self.stdout.write(self.style.SUCCESS(f"  after : {after}"))
            self.stdout.write("")

        verb = "Updated" if apply_changes else "Would update"
        self.stdout.write(
            f"{verb} {changed_articles} articles and {changed_stories} stories."
        )
        if not apply_changes and (changed_articles or changed_stories):
            self.stdout.write(self.style.WARNING("Dry run — pass --apply to write."))

        if apply_changes and changed_articles:
            self.stdout.write(
                self.style.WARNING(
                    "Excerpts changed, so their embeddings are now stale. Clear them "
                    "with Article.objects.update(embedding=None) and let clustering "
                    "recompute if similarity quality matters."
                )
            )
