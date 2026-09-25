"""
Re-assign topics across the corpus: articles by evidence, stories by consensus.

Articles are re-scored with both signals in core.topics (the publisher's own
filing plus the text), then every story is re-voted, one vote per publisher.
Reports story coverage before and after, which is the number that matters: an
untagged story never appears on any topic page.

    python manage.py recategorize_all                # report only
    python manage.py recategorize_all --apply
    python manage.py recategorize_all --apply --days 14

Built for a remote database. The per-article path the pipeline uses costs
four or five round trips an article; from a CI runner to Neon that ran past
the maintenance job's 30-minute budget on a fortnight of stories. Here each
batch of stories is one read of its articles, one bulk update of their
evidence, and one rewrite of each topic join table, in a single transaction.
Stories go newest first, so a run cut short has already fixed what readers
see.
"""
from collections import Counter, defaultdict
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import Article, Category, Story


class Command(BaseCommand):
    help = "Re-assign article and story topics (editorial + semantic evidence, story consensus)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Persist changes.")
        parser.add_argument("--days", type=int, default=0, help="Only stories updated in the last N days (0 = all).")
        parser.add_argument("--batch", type=int, default=200, help="Stories per batch.")

    def handle(self, *args, **opts):
        from core.services.scraper import is_commerce
        from core.topics import editorial_hints, pick_topics, story_topics, topic_evidence

        stories = Story.objects.all()
        if opts["days"]:
            stories = stories.filter(last_updated_at__gte=timezone.now() - timedelta(days=opts["days"]))
        story_ids = list(stories.order_by("-last_updated_at").values_list("pk", flat=True))
        total = len(story_ids)
        if not total:
            self.stderr.write("No stories in range.")
            return

        StoryTopic = Story.categories.through
        ArticleTopic = Article.categories.through
        before = StoryTopic.objects.filter(story_id__in=story_ids).values("story_id").distinct().count()
        self.stdout.write(f"{total} stories · {before / total * 100:.1f}% tagged before")

        category_ids = dict(Category.objects.values_list("slug", "pk"))
        tagged, articles_done = 0, 0
        primaries = Counter()

        for start in range(0, total, opts["batch"]):
            batch = story_ids[start:start + opts["batch"]]
            articles = list(
                Article.objects.filter(story_id__in=batch)
                .select_related("source")
                .only(
                    "pk", "story_id", "url", "title", "feed_tags", "embedding", "topic_scores",
                    "source__url", "source__publisher_domain", "source__name",
                )
            )

            votes = defaultdict(list)
            article_topics = {}
            for article in articles:
                source = article.source
                if is_commerce(article.url, article.title):
                    evidence = {}
                else:
                    evidence = topic_evidence(
                        article.embedding,
                        editorial_hints(
                            article_url=article.url,
                            feed_url=source.url if source else "",
                            tags=article.feed_tags or (),
                            publisher_domain=(source.publisher_domain or "") if source else "",
                        ),
                    )
                article.topic_scores = evidence or None
                article_topics[article.pk] = pick_topics(evidence)
                if evidence:
                    publisher = (source.publisher_domain or source.name) if source else "?"
                    votes[article.story_id].append((publisher, evidence))

            story_slugs = {sid: story_topics(votes.get(sid, [])) for sid in batch}

            if opts["apply"]:
                with transaction.atomic():
                    Article.objects.bulk_update(articles, ["topic_scores"], batch_size=500)
                    ArticleTopic.objects.filter(article_id__in=list(article_topics)).delete()
                    ArticleTopic.objects.bulk_create([
                        ArticleTopic(article_id=aid, category_id=category_ids[slug])
                        for aid, slugs in article_topics.items()
                        for slug in slugs if slug in category_ids
                    ])
                    StoryTopic.objects.filter(story_id__in=batch).delete()
                    StoryTopic.objects.bulk_create([
                        StoryTopic(story_id=sid, category_id=category_ids[slug])
                        for sid, slugs in story_slugs.items()
                        for slug in slugs if slug in category_ids
                    ])
                    by_primary = defaultdict(list)
                    for sid, slugs in story_slugs.items():
                        by_primary[category_ids.get(slugs[0]) if slugs else None].append(sid)
                    for category_id, ids in by_primary.items():
                        Story.objects.filter(pk__in=ids).update(primary_category_id=category_id)

            articles_done += len(articles)
            for slugs in story_slugs.values():
                if slugs:
                    tagged += 1
                    primaries[slugs[0]] += 1
            self.stdout.write(f"  {min(start + opts['batch'], total)}/{total} stories")

        self.stdout.write("Primary topic per story:")
        for slug, count in primaries.most_common():
            self.stdout.write(f"  {count:6}  {slug}")
        self.stdout.write("")
        self.stdout.write(
            f"{'Applied' if opts['apply'] else 'Would apply'}: {articles_done} articles re-scored · "
            f"{tagged / total * 100:.1f}% of stories tagged after ({total - tagged} untagged)"
        )
        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("Dry run — pass --apply to write."))
