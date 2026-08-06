"""
Sweep the topic-assignment threshold over the real corpus.

Keyword categorisation left 47% of articles with no topic. The point of this
command is to check that the semantic classifier does materially better without
swinging to the opposite failure — tagging everything, which is just as useless.

    python manage.py calibrate_topics
    python manage.py calibrate_topics --show tech --threshold 0.62
"""
from collections import Counter

from django.core.management.base import BaseCommand

from core.models import Article
from core.topics import TOPICS_BY_SLUG, classify, score_topics


class Command(BaseCommand):
    help = "Sweep topic thresholds against embedded articles and report coverage."

    def add_arguments(self, parser):
        parser.add_argument("--thresholds", nargs="+", type=float,
                            default=[0.55, 0.58, 0.60, 0.62, 0.65, 0.68])
        parser.add_argument("--limit", type=int, default=1000)
        parser.add_argument("--show", type=str, help="Print sample headlines for this topic slug.")
        parser.add_argument("--threshold", type=float, default=0.62, help="Threshold used by --show.")

    def handle(self, *args, **opts):
        articles = list(
            Article.objects.filter(embedding__isnull=False)
            .only("id", "title", "embedding")[: opts["limit"]]
        )
        if not articles:
            self.stderr.write("No embedded articles. Run ingestion and clustering first.")
            return

        self.stdout.write(f"Corpus: {len(articles)} embedded articles\n")

        if opts["show"]:
            self._show(articles, opts["show"], opts["threshold"])
            return

        for threshold in opts["thresholds"]:
            self._report(articles, threshold)

    def _report(self, articles, threshold):
        counts = Counter()
        tagged = 0
        multi = 0

        for article in articles:
            chosen = classify(article.embedding, threshold=threshold)
            if chosen:
                tagged += 1
                if len(chosen) > 1:
                    multi += 1
                for slug, _score in chosen:
                    counts[slug] += 1

        coverage = tagged / len(articles) * 100
        empty_topics = [t for t in TOPICS_BY_SLUG if counts[t] == 0]

        self.stdout.write(self.style.MIGRATE_HEADING(f"threshold={threshold:.2f}"))
        self.stdout.write(
            f"  coverage={coverage:5.1f}%   untagged={len(articles) - tagged:4d}   "
            f"dual-tagged={multi}"
        )
        self.stdout.write(
            "  " + "  ".join(f"{slug}:{counts[slug]}" for slug, _ in counts.most_common())
        )
        if empty_topics:
            self.stdout.write(self.style.WARNING(f"  empty topics: {', '.join(empty_topics)}"))
        self.stdout.write("")

    def _show(self, articles, slug, threshold):
        self.stdout.write(f"Articles classified as '{slug}' at threshold {threshold}:\n")
        shown = 0
        for article in articles:
            chosen = classify(article.embedding, threshold=threshold)
            if any(s == slug for s, _ in chosen):
                score = next(sc for s, sc in chosen if s == slug)
                self.stdout.write(f"  {score:.3f}  {article.title[:92]}")
                shown += 1
                if shown >= 20:
                    break

        self.stdout.write("\nLowest-confidence assignments overall (possible misfits):\n")
        scored = []
        for article in articles:
            ranked = score_topics(article.embedding)
            if ranked:
                scored.append((ranked[0][1], ranked[0][0], article.title))
        for score, top, title in sorted(scored)[:10]:
            self.stdout.write(f"  {score:.3f}  [{top}]  {title[:82]}")
