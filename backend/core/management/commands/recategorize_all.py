"""
Re-assign topics across the corpus using the semantic classifier.

Replaces a keyword-matching pass that left 47% of articles untagged and named
slugs (`art`, `entertainment`) that no longer exist. Classification needs an
embedding, so articles without one are skipped — clustering computes them.

    python manage.py recategorize_all            # report only
    python manage.py recategorize_all --apply
"""
from collections import Counter

from django.core.management.base import BaseCommand

from core.models import Article


class Command(BaseCommand):
    help = "Re-assign article topics with the semantic classifier."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Persist changes.")
        parser.add_argument("--batch", type=int, default=500)

    def handle(self, *args, **opts):
        from core.clustering import _assign_topics
        from core.topics import classify

        queryset = Article.objects.filter(embedding__isnull=False)
        total = queryset.count()
        if not total:
            self.stderr.write(
                "No embedded articles. Topics are assigned during clustering, "
                "so run ingestion and clustering first."
            )
            return

        self.stdout.write(f"Classifying {total} embedded articles…\n")

        counts = Counter()
        untagged = 0
        processed = 0

        for article in queryset.iterator(chunk_size=opts["batch"]):
            chosen = classify(article.embedding)
            if chosen:
                for slug, _score in chosen:
                    counts[slug] += 1
            else:
                untagged += 1

            if opts["apply"]:
                _assign_topics(article)
            processed += 1

        self.stdout.write("")
        for slug, count in counts.most_common():
            self.stdout.write(f"  {count:5}  {slug}")

        coverage = (processed - untagged) / processed * 100 if processed else 0
        self.stdout.write("")
        self.stdout.write(
            f"{'Applied to' if opts['apply'] else 'Would tag'} {processed} articles · "
            f"coverage {coverage:.1f}% · {untagged} untagged"
        )
        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("Dry run — pass --apply to write."))
