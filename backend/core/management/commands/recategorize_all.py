"""
Re-assign topics across the corpus: articles by evidence, stories by consensus.

Articles are re-scored with both signals in core.topics (the publisher's own
filing plus the text), then every story touched is re-voted, one vote per
publisher. Reports story coverage before and after, which is the number that
matters: an untagged story never appears on any topic page.

    python manage.py recategorize_all                # report only
    python manage.py recategorize_all --apply
    python manage.py recategorize_all --apply --days 14
"""
from collections import Counter
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Article, Story


class Command(BaseCommand):
    help = "Re-assign article and story topics (editorial + semantic evidence, story consensus)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Persist changes.")
        parser.add_argument("--days", type=int, default=0, help="Only stories updated in the last N days (0 = all).")
        parser.add_argument("--batch", type=int, default=500)

    def handle(self, *args, **opts):
        from core.clustering import _assign_topics, refresh_story_topics
        from core.topics import editorial_hints, story_topics, topic_evidence

        stories = Story.objects.all()
        if opts["days"]:
            stories = stories.filter(last_updated_at__gte=timezone.now() - timedelta(days=opts["days"]))
        total = stories.count()
        if not total:
            self.stderr.write("No stories in range.")
            return

        before_tagged = stories.filter(categories__isnull=False).distinct().count()
        self.stdout.write(f"{total} stories · {before_tagged / total * 100:.1f}% tagged before\n")

        articles = (
            Article.objects.filter(story__in=stories)
            .select_related("source")
        )
        processed = 0
        for article in articles.iterator(chunk_size=opts["batch"]):
            if opts["apply"]:
                _assign_topics(article)
            else:
                source = article.source
                article.topic_scores = topic_evidence(
                    article.embedding,
                    editorial_hints(
                        article_url=article.url,
                        feed_url=source.url if source else "",
                        tags=article.feed_tags or (),
                        publisher_domain=(source.publisher_domain or "") if source else "",
                    ),
                ) or None
                # Dry run: keep the evidence in memory only.
                self._dry[article.pk] = (source.publisher_domain or source.name, article.topic_scores, article.story_id)
            processed += 1

        counts = Counter()
        tagged = 0
        if opts["apply"]:
            for story in stories.iterator(chunk_size=opts["batch"]):
                refresh_story_topics(story)
            for story in stories.prefetch_related("categories"):
                slugs = [c.slug for c in story.categories.all()]
                if slugs:
                    tagged += 1
                    counts[story.primary_category.slug if story.primary_category else slugs[0]] += 1
        else:
            by_story: dict[int, list] = {}
            for publisher, scores, story_id in self._dry.values():
                if scores:
                    by_story.setdefault(story_id, []).append((publisher, scores))
            for votes in by_story.values():
                slugs = story_topics(votes)
                if slugs:
                    tagged += 1
                    counts[slugs[0]] += 1

        self.stdout.write("Primary topic per story:")
        for slug, count in counts.most_common():
            self.stdout.write(f"  {count:6}  {slug}")
        self.stdout.write("")
        self.stdout.write(
            f"{'Applied' if opts['apply'] else 'Would apply'}: {processed} articles re-scored · "
            f"{tagged / total * 100:.1f}% of stories tagged after ({total - tagged} untagged)"
        )
        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("Dry run — pass --apply to write."))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._dry: dict[int, tuple] = {}
