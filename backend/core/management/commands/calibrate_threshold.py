"""
Sweep the clustering threshold against the real ingested corpus.

The labeled pair set in core/tests/test_embedding_scorer.py is small enough to be
misleading on its own: a threshold that separates seven hand-picked pairs can
still merge unrelated events once thousands of real headlines are in play. This
command re-clusters the live corpus at several thresholds and reports the size
distribution, which is what actually exposes topic bleed — a cluster far larger
than the number of outlets covering one event is a blob, not a story.

Usage:
    python manage.py calibrate_threshold --thresholds 0.68 0.75 0.80 0.85
"""
from collections import defaultdict

import numpy as np
from django.core.management.base import BaseCommand

from core.models import Article


class Command(BaseCommand):
    help = "Sweep clustering thresholds over the ingested corpus and report cluster sizes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--thresholds", nargs="+", type=float,
            default=[0.68, 0.72, 0.75, 0.78, 0.80, 0.83, 0.86],
        )
        parser.add_argument("--limit", type=int, default=2000)
        parser.add_argument(
            "--centroid", action="store_true",
            help="Update the cluster centroid as a running mean (mirrors _update_centroid).",
        )

    def handle(self, *args, **opts):
        articles = list(
            Article.objects.filter(embedding__isnull=False)
            .select_related("source")
            .order_by("published_date")[: opts["limit"]]
        )
        if not articles:
            self.stderr.write("No embedded articles. Run ingestion + clustering first.")
            return

        vectors = np.array([a.embedding for a in articles], dtype=float)
        # Normalise once so cosine similarity is a plain dot product.
        vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
        self.stdout.write(f"Corpus: {len(articles)} embedded articles\n")

        for threshold in opts["thresholds"]:
            self._report(articles, vectors, threshold, opts["centroid"])

    def _report(self, articles, vectors, threshold, use_centroid):
        """Greedy sequential assignment — the same shape as cluster_article()."""
        centroids: list[np.ndarray] = []
        counts: list[int] = []
        members = defaultdict(list)

        for idx, vec in enumerate(vectors):
            best, best_score = -1, 0.0
            for cid, centroid in enumerate(centroids):
                score = float(vec @ centroid)
                if score > best_score and score >= threshold:
                    best, best_score = cid, score

            if best >= 0:
                members[best].append(idx)
                if use_centroid:
                    n = counts[best]
                    merged = (centroids[best] * n + vec) / (n + 1)
                    centroids[best] = merged / np.linalg.norm(merged)
                counts[best] += 1
            else:
                centroids.append(vec.copy())
                counts.append(1)
                members[len(centroids) - 1].append(idx)

        sizes = sorted(counts, reverse=True)
        multi = [s for s in sizes if s > 1]
        singletons = len(sizes) - len(multi)

        # Distinct publishers in the biggest cluster: a genuine event caps out
        # near the number of outlets that cover it, a topic blob does not.
        largest_id = int(np.argmax(counts))
        largest_titles = [articles[i].title for i in members[largest_id][:3]]

        self.stdout.write(self.style.MIGRATE_HEADING(f"threshold={threshold:.2f}"))
        self.stdout.write(
            f"  clusters={len(sizes)}  multi-article={len(multi)}  singletons={singletons}"
        )
        self.stdout.write(f"  largest={sizes[0]}  top-5 sizes={sizes[:5]}")
        for t in largest_titles:
            self.stdout.write(f"    · {t[:88]}")
        self.stdout.write("")
