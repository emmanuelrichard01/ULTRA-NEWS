"""
Compare embedding models on the cases the current one gets wrong.

bge-small-en-v1.5 cannot separate two things this product depends on:

  1. Same-event paraphrases ("CBN" vs "Apex Bank") score 0.727–0.766, while
     different-event same-topic pairs reach 0.730. The classes overlap, so no
     clustering threshold catches the paraphrases without also merging unrelated
     stories — a measured recall ceiling, not a tuning mistake.

  2. Topic prototypes: absolute similarity is uninformative, so filler like
     "..." scores higher against Technology than a real story about missile
     strikes.

The metric that matters is SEPARATION: the gap between the weakest true match
and the strongest false one. Negative means the classes overlap and no threshold
exists. Accuracy on a handful of pairs is not the point — the gap is.

    python manage.py benchmark_embeddings
    python manage.py benchmark_embeddings --models BAAI/bge-base-en-v1.5
"""
import numpy as np
from django.core.management.base import BaseCommand

# Same real-world event, reported by different outlets. These MUST cluster.
SAME_EVENT = [
    ("brazil_visa",
     "US revokes visa of Brazilian ambassador amid deepening diplomatic spat",
     "White House revokes visa of Brazil's ambassador to US"),
    ("channel_rescue",
     "More Than 170 Migrants Rescued From Burning Boat in English Channel",
     "More than 170 migrants rescued after boat catches fire in Channel"),
    ("moscow_drone",
     "Ukraine drone strikes kill five near Moscow, Russia says",
     "Ukraine hits more Wildberries sites as strike kills five in Moscow region"),
    # The hard ones — same event, entirely different vocabulary.
    ("cbn_paraphrase",
     "CBN Retains Benchmark Interest Rate at 27.25% Amid Inflation Concerns",
     "Apex Bank Keeps Monetary Policy Rate Unchanged at 27.25 Percent"),
    ("openai_paraphrase",
     "OpenAI Unveils New Flagship AI System Globally",
     "Sam Altman Announces Next-Generation AI Model Release"),
    ("central_bank_reword",
     "Central Bank Holds Rates Steady Amid Inflation Concerns",
     "Central Bank Keeps Rates Unchanged"),
]

# Different events. Several share a topic and vocabulary — the pairs that drag
# unrelated stories into one cluster. These must NOT cluster.
DIFFERENT_EVENT = [
    ("ai_opinions",
     "When China's open-source AI is a trap",
     "Sovereign AI, independent of America and China, is a pipe dream"),
    ("separate_drones",
     "Ukraine drone strikes kill five near Moscow, Russia says",
     "Drone Explodes on Russian Beach, Killing 7, Officials Say"),
    ("canada_diplomacy",
     "U.S. State Department to close consulate in Winnipeg, sources say",
     "Canada cuts its UN peacekeeping forces as it tilts to Europe and Indo-Pacific"),
    ("commentary",
     "Donald Trump could be the man to save Cuba",
     "Why strongmen are wrong to loathe Europe"),
    ("cbn_different",
     "CBN Retains Benchmark Interest Rate at 27.25% Amid Inflation Concerns",
     "Central Bank Appoints New Deputy Governor for Financial Stability"),
    ("openai_different",
     "OpenAI Unveils New Flagship AI System Globally",
     "OpenAI Faces Copyright Lawsuit from Publishing Consortium"),
    ("rival_labs",
     "OpenAI Unveils New Flagship AI System Globally",
     "Google Announces Gemini Model Update"),
]

DEFAULT_MODELS = [
    "BAAI/bge-small-en-v1.5",
    "BAAI/bge-base-en-v1.5",
    "thenlper/gte-base",
    "jinaai/jina-embeddings-v2-base-en",
]


class Command(BaseCommand):
    help = "Benchmark embedding models on same-event vs different-event separation."

    def add_arguments(self, parser):
        parser.add_argument("--models", nargs="+", default=DEFAULT_MODELS)

    def handle(self, *args, **opts):
        from fastembed import TextEmbedding

        results = []

        for model_name in opts["models"]:
            self.stdout.write(f"\nLoading {model_name} …")
            try:
                model = TextEmbedding(model_name=model_name)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  unavailable: {str(e)[:110]}"))
                continue

            # `model` is bound as a default rather than captured: a closure over
            # the loop variable would make every iteration score the LAST model,
            # so the benchmark would compare a model against itself and report
            # perfect separation.
            def sim(a: str, b: str, model=model) -> float:
                va, vb = (np.array(v, dtype=float) for v in model.embed([a, b]))
                return float(va @ vb / (np.linalg.norm(va) * np.linalg.norm(vb)))

            same = [(pid, sim(a, b)) for pid, a, b in SAME_EVENT]
            diff = [(pid, sim(a, b)) for pid, a, b in DIFFERENT_EVENT]

            weakest_true = min(s for _, s in same)
            strongest_false = max(s for _, s in diff)
            gap = weakest_true - strongest_false

            # How many true pairs sit above every false pair — i.e. how much
            # recall a perfectly-placed threshold could actually achieve.
            recoverable = sum(1 for _, s in same if s > strongest_false)

            results.append((model_name, gap, recoverable, len(same), weakest_true, strongest_false))

            style = self.style.SUCCESS if gap > 0 else self.style.ERROR
            self.stdout.write(style(
                f"  separation = {gap:+.4f}   "
                f"(weakest true {weakest_true:.3f} vs strongest false {strongest_false:.3f})"
            ))
            self.stdout.write(
                f"  recoverable same-event pairs: {recoverable}/{len(same)}"
            )
            self.stdout.write("    same-event:")
            for pid, s in sorted(same, key=lambda x: x[1]):
                flag = "  " if s > strongest_false else " <-- lost"
                self.stdout.write(f"      {s:.4f}  {pid}{flag}")
            self.stdout.write("    different-event:")
            for pid, s in sorted(diff, key=lambda x: -x[1])[:3]:
                self.stdout.write(f"      {s:.4f}  {pid}")

        if not results:
            return

        self.stdout.write("\n" + "=" * 72)
        self.stdout.write("RANKING (higher separation is better; negative = classes overlap)")
        for name, gap, rec, total, _wt, _sf in sorted(results, key=lambda r: -r[1]):
            self.stdout.write(f"  {gap:+.4f}   {rec}/{total} recoverable   {name}")
