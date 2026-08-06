import logging
import re
import uuid
from datetime import timedelta
from typing import Protocol

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from core.models import Article, Story

try:
    import numpy as np
    from fastembed import TextEmbedding
except ImportError:
    TextEmbedding = None
    np = None

logger = logging.getLogger(__name__)

# How many nearest stories pgvector returns for exact re-scoring. The ANN index
# gives us an ordered shortlist; we still verify each one against the threshold
# and the time window, so this only needs to be wide enough that the true match
# can't fall outside it.
ANN_CANDIDATE_LIMIT = 25

# Cosine similarity above which two headlines are treated as the same event.
#
# Calibrated against a live 500-article corpus (see `manage.py
# calibrate_threshold`), not against hand-picked pairs alone. Measured on
# BAAI/bge-small-en-v1.5:
#
#   same event, wire syndication    0.806, 0.931, 0.960   <- the common case
#   same event, heavy paraphrase    0.727, 0.766          <- rare
#   different event, same topic     0.465, 0.578, 0.656, 0.730
#
# These classes OVERLAP. Two unrelated AI opinion pieces score 0.730, above the
# 0.727 scored by a genuine paraphrase pair. No threshold separates them, so the
# choice is which error to make — and for a product whose entire claim is
# verification, a false merge is far more damaging than a missed one. A missed
# merge shows up as two single-source Wire entries; a false merge fabricates a
# "corroborated" story out of unrelated events.
#
# 0.80 clears every observed different-event pair and sits at the floor of the
# wire-syndication band. Sweeping the real corpus, it is the lowest value whose
# largest cluster is still a single genuine event (6 articles); at 0.78 a
# separate Russian drone incident is absorbed, and at 0.68 the largest cluster
# reaches 112 articles of unrelated geopolitics.
#
# Known limitation: vocabulary-divergent paraphrases ("CBN" vs "Apex Bank") fall
# below this and stay unclustered. That is a recall ceiling of the embedding
# model on short headlines, not a tuning mistake — see
# core/tests/test_embedding_scorer.py.
EMBEDDING_MATCH_THRESHOLD = 0.80

# Jaccard over-penalises the length asymmetry that is normal between headlines,
# so the lexical fallback uses the overlap coefficient instead. See
# TokenOverlapScorer for the rationale.
TOKEN_MATCH_THRESHOLD = 0.50

# Clustering only ever compares against stories this recent.
CANDIDATE_WINDOW = timedelta(days=7)

_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None and TextEmbedding is not None:
        # 384-dimensional efficient model
        _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedding_model


def embed_text(text: str) -> list[float] | None:
    """Embed a single string, or return None when embeddings are unavailable."""
    model = get_embedding_model()
    if not model or not text or not text.strip():
        return None
    embeddings = list(model.embed([text]))
    if not embeddings:
        return None
    return [float(x) for x in embeddings[0]]


def compute_velocity(independent_count: int, first_seen_at) -> float:
    """
    Independent publishers per hour since the story broke.

    Single definition on purpose — this used to be computed two different ways
    (independent_count/hours here, source_count/hours in the Celery task), which
    meant the feed ranking disagreed with the number shown on the story page.
    """
    hours_alive = (timezone.now() - first_seen_at).total_seconds() / 3600.0
    if hours_alive <= 0:
        return float(independent_count)
    return independent_count / hours_alive

STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
    'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
    'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
    'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
}

class ClusterScorer(Protocol):
    """Returns 0.0-1.0: how likely `candidate` belongs to the same real-world event as `existing`."""
    def similarity(self, candidate: Article, existing: Story) -> float: ...

# A shorter headline must still share this many content words to count as a match,
# which stops two-word titles scoring 1.0 off a single incidental token.
MIN_SHARED_TOKENS = 2


class TokenOverlapScorer:
    """
    Lexical fallback for when embeddings are unavailable. No ML infra, no
    dependency, no API cost. Compares stemmed titles within a 72-hour window.

    Scored with the overlap coefficient — |A n B| / min(|A|, |B|) — rather than
    Jaccard. Headlines covering one event routinely differ a lot in length
    ("Central Bank Keeps Rates Unchanged" vs "Central Bank Holds Rates Steady
    Amid Inflation Concerns"), and Jaccard divides by the union, so those extra
    words in the longer headline actively push a true match *down*. That pair
    scores 0.30 under Jaccard — below the 0.35 threshold the code used, so the
    lexical path could not cluster real headlines at all. Overlap coefficient
    scores it 0.60, and different-event pairs sharing an entity stay well under
    the threshold because they share only that entity.
    """

    def _token_set(self, text: str) -> set:
        # Lowercase, strip punctuation
        words = re.findall(r'\b\w+\b', text.lower())
        tokens = set()
        for w in words:
            if w not in STOPWORDS:
                # Basic stemming (remove trailing 's')
                if w.endswith('s') and len(w) > 3:
                    w = w[:-1]
                tokens.add(w)
        return tokens

    def similarity(self, candidate: Article, existing: Story) -> float:
        # Time window check (72 hours)
        window = timedelta(hours=72)
        if abs(candidate.published_date - existing.first_seen_at) > window:
            return 0.0

        a = self._token_set(candidate.title)
        b = self._token_set(existing.title)

        if not a or not b:
            return 0.0

        shared = len(a & b)
        if shared < MIN_SHARED_TOKENS:
            return 0.0

        return shared / min(len(a), len(b))

class EmbeddingScorer:
    """Phase 3: Semantic embedding clustering via fastembed."""
    def similarity(self, candidate: Article, existing: Story) -> float:
        # Time window check (72 hours)
        window = timedelta(hours=72)
        if abs(candidate.published_date - existing.first_seen_at) > window:
            return 0.0
            
        if not candidate.embedding or not existing.embedding:
            return 0.0
            
        a = np.array(candidate.embedding)
        b = np.array(existing.embedding)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
            
        # Cosine similarity
        return float(np.dot(a, b) / (norm_a * norm_b))

def compute_tier(independent_count: int, velocity: float, has_primary_source: bool) -> str:
    """
    Compute the Tier (Status) of a Story based on independent source count.

    Rules (STRICT — independent_count is the ONLY promotion signal):
      - 3+ independent domains → CORROBORATED (Reporting feed)
      - 2 independent domains  → DEVELOPING (Developing feed)
      - 1 source               → WIRE (The Wire feed)

    Velocity is a *ranking* signal WITHIN a tier, never a tier-promotion
    signal. A single-source story with high velocity is still Wire —
    it's just a highly-active Wire story that ranks higher in the feed.

    This prevents the inflation bug where every new story (1 source,
    velocity=0.0) was incorrectly promoted to Developing.
    """
    if independent_count >= 3:
        return Story.Status.CORROBORATED

    if independent_count >= 2:
        return Story.Status.DEVELOPING

    # Single source — always Wire, regardless of velocity
    return Story.Status.WIRE

def _candidate_stories(article: Article, use_ann: bool):
    """
    Shortlist the stories worth scoring against this article.

    With embeddings we let pgvector narrow the field and annotate each candidate
    with the cosine distance it already computed while ordering. Cosine similarity
    is then just `1 - distance`, so no vector maths happens in Python at all.

    Two things this replaces:
      - Loading every story from the last 7 days *with*
        `prefetch_related('articles__source')` and running a Python cosine loop
        over all of them — O(articles x stories) per cycle, hydrating whole
        clusters that were about to be discarded.
      - Recomputing, per candidate, the exact distance the database had just
        calculated: two 384-float lists converted to numpy arrays 25 times per
        article. That conversion dominated the clustering loop.
    """
    recent_window = article.published_date - CANDIDATE_WINDOW
    qs = Story.objects.filter(first_seen_at__gte=recent_window)

    if use_ann and article.embedding is not None:
        from pgvector.django import CosineDistance
        return (
            qs.filter(embedding__isnull=False)
            .annotate(_distance=CosineDistance('embedding', article.embedding))
            .only('id', 'title', 'slug', 'first_seen_at', 'source_count',
                  'independent_count', 'synthesis_status', 'synthesis_source_count',
                  'status', 'embedding')
            .order_by('_distance')[:ANN_CANDIDATE_LIMIT]
        )

    # Lexical fallback: scoring only reads title and first_seen_at.
    return qs.only('id', 'title', 'first_seen_at', 'embedding')


def _recount_cluster(story: Story) -> tuple[int, int, bool]:
    """
    Recompute (source_count, independent_count, has_primary_source) from the DB.

    independent_count is the number of distinct *publishers*, not distinct feed
    URLs. Counting feeds meant two BBC feeds read as two independent
    corroborations and falsely promoted the story to Developing.
    """
    rows = story.articles.values_list(
        'source__publisher_domain', 'source__url', 'source__source_type'
    )
    publishers = set()
    has_primary = False
    total = 0
    for domain, url, source_type in rows:
        total += 1
        publishers.add(domain or url)
        if source_type == 'primary':
            has_primary = True
    return total, len(publishers), has_primary


def _update_centroid(story: Story, article: Article) -> None:
    """
    Fold the new article into the story's centroid as a running mean.

    The centroid used to be frozen at whatever the first article's embedding was,
    so as a cluster grew its stored vector drifted away from what the cluster
    actually covered — degrading both future matching and /related.
    """
    if np is None or article.embedding is None:
        return
    if story.embedding is None:
        story.embedding = article.embedding
        return

    n = max(story.source_count, 1)
    centroid = np.asarray(story.embedding, dtype=float)
    incoming = np.asarray(article.embedding, dtype=float)
    if centroid.shape != incoming.shape:
        return

    merged = (centroid * n + incoming) / (n + 1)
    norm = np.linalg.norm(merged)
    if norm > 0:
        merged = merged / norm
    story.embedding = [float(x) for x in merged]


def _assign_topics(article: Article) -> None:
    """
    Classify the article semantically and attach the matching Category rows.

    Replaces keyword matching, which left 47% of a 619-article corpus untagged.
    Failures are swallowed deliberately: a classification problem must not stop
    an article being clustered and published.
    """
    if article.embedding is None:
        return

    try:
        from core.models import Category
        from core.topics import classify

        chosen = classify(article.embedding)
        if not chosen:
            return

        slugs = [slug for slug, _score in chosen]
        categories = list(Category.objects.filter(slug__in=slugs))
        if categories:
            article.categories.set(categories)
    except Exception as e:
        logger.warning("Topic classification failed for article %s: %s", article.pk, e)


# A brief is only worth regenerating once this many NEW independent publishers
# have joined. Another article from an outlet already in the cluster changes the
# multi-source picture very little, and each regeneration is a full-price call.
NEW_OUTLETS_BEFORE_RESYNTHESIS = 2

# Floor on how often one story can be re-synthesised, whatever else happens. A
# fast-moving story can gain outlets every few minutes; without this it would
# regenerate its entire brief each time.
RESYNTHESIS_COOLDOWN = timedelta(minutes=20)


def _should_resynthesize(story: Story) -> bool:
    """
    Decide whether a story's intelligence brief is worth regenerating.

    Previously keyed on article count — two more articles triggered a full
    regeneration even when both came from outlets already represented, which is
    paying full price to change a sentence. Gating on *new independent
    publishers* means the brief is rebuilt when the corroboration picture
    actually changed.
    """
    if story.status not in (Story.Status.DEVELOPING, Story.Status.CORROBORATED):
        return False

    # Never synthesised: do it once, as soon as it clears Wire.
    if story.synthesis_status == Story.SynthesisStatus.IDLE:
        return True

    # Don't pile onto a run already in flight, or retry a failure here — the
    # task has its own retry policy.
    if story.synthesis_status == Story.SynthesisStatus.PENDING:
        return False

    if story.synthesized_at and timezone.now() - story.synthesized_at < RESYNTHESIS_COOLDOWN:
        return False

    new_outlets = story.independent_count - story.synthesis_independent_count
    return new_outlets >= NEW_OUTLETS_BEFORE_RESYNTHESIS


def _dispatch_synthesis(story_id: int) -> None:
    """
    Queue AI synthesis once the surrounding transaction commits.

    Dispatching inline let a worker pick the task up before the cluster update was
    visible, so synthesis could read stale counts — or miss the story entirely.
    """
    from core.dispatch import dispatch, dispatch_enabled

    # Cheap check before registering an on_commit callback that would do nothing.
    if not dispatch_enabled():
        return

    def _send():
        from core.tasks import synthesize_story_brief
        dispatch(
            synthesize_story_brief, story_id,
            description=f"synthesis for story {story_id}",
        )

    transaction.on_commit(_send)


def cluster_article(article: Article, scorer: ClusterScorer = None) -> Story:
    """
    Assign an Article to an existing Story cluster or create a new one.
    """
    model = get_embedding_model()

    # Generate embedding for candidate article if not present
    if model and article.embedding is None:
        article.embedding = embed_text(f"{article.title} {article.excerpt}")

    # Topics are assigned here rather than at ingest time because classification
    # is semantic and needs the embedding. Keyword matching used to run during
    # scraping over the full article body, which is why a single passing mention
    # of a company could file a politics story under Technology.
    _assign_topics(article)

    if scorer is None:
        scorer = EmbeddingScorer() if model else TokenOverlapScorer()

    with transaction.atomic():
        use_ann = isinstance(scorer, EmbeddingScorer)
        candidate_stories = _candidate_stories(article, use_ann)

        best_match = None
        best_score = 0.0
        threshold = EMBEDDING_MATCH_THRESHOLD if use_ann else TOKEN_MATCH_THRESHOLD
        window = timedelta(hours=72)

        for story in candidate_stories:
            if use_ann:
                # pgvector ordered by this distance; reuse it rather than
                # recomputing the same number in Python.
                if abs(article.published_date - story.first_seen_at) > window:
                    continue
                score = 1.0 - float(story._distance)
            else:
                score = scorer.similarity(article, story)

            if use_ann and score < threshold:
                # Candidates arrive nearest-first, so similarity decreases
                # monotonically — nothing after this can clear the threshold.
                break

            if score > best_score and score >= threshold:
                best_score = score
                best_match = story

        if best_match:
            logger.info(
                "Cluster match: article='%.60s' → story='%.60s' (score=%.3f, scorer=%s)",
                article.title, best_match.title, best_score, type(scorer).__name__,
            )
            # Add to existing cluster
            if not best_match.articles.filter(id=article.id).exists():
                article.story = best_match
                # `embedding` MUST be in update_fields. It was computed above but
                # only 'story' was persisted, so every Article.embedding stayed
                # NULL — which silently broke the /ask vector search entirely.
                article.save(update_fields=['story', 'embedding'])

                # Captured before recount so a promotion out of Wire can be
                # detected and announced to the ticker.
                previous_status = best_match.status

                source_count, independent_count, primary_found = _recount_cluster(best_match)
                best_match.source_count = source_count
                best_match.independent_count = independent_count
                best_match.velocity_score = compute_velocity(
                    independent_count, best_match.first_seen_at
                )
                # Compute Tier (independent_count is the ONLY promotion signal)
                best_match.status = compute_tier(
                    independent_count, best_match.velocity_score, primary_found
                )
                _update_centroid(best_match, article)

                # Merge article categories into story categories
                article_cats = set(article.categories.values_list('id', flat=True))
                if article_cats:
                    existing_cats = set(best_match.categories.values_list('id', flat=True))
                    new_cats = article_cats - existing_cats
                    if new_cats:
                        best_match.categories.add(*new_cats)

                # Narrow write: a bare save() clobbered every column, racing with
                # the synthesis task's concurrent update of ai_summary/status.
                best_match.save(update_fields=[
                    'source_count', 'independent_count', 'velocity_score',
                    'status', 'embedding', 'last_updated_at',
                ])
                best_match.update_primary_source()

                # Materialised momentum for the Developing edition. Refreshed
                # here so a story that just gained an outlet ranks immediately,
                # rather than waiting for the periodic decay pass.
                #
                # Skipped in a batch run that ends with a full refresh — there it
                # costs ~1.3s per matched story to compute a number that gets
                # recomputed minutes later.
                if getattr(settings, "MOMENTUM_REFRESH_ON_CLUSTER", True):
                    from core.momentum import refresh_momentum
                    refresh_momentum([best_match.pk])

                # The story page is cached; purge it now that the cluster has
                # actually changed.
                from core.invalidation import invalidate_story, publish_promotion
                invalidate_story(best_match.slug)

                # Announce a promotion to the ticker at the moment it happens,
                # rather than having every connected reader poll for it.
                if (
                    previous_status == Story.Status.WIRE
                    and best_match.status != Story.Status.WIRE
                ):
                    publish_promotion(best_match)

                if _should_resynthesize(best_match):
                    _dispatch_synthesis(best_match.id)

            return best_match
        else:
            # Create new Story
            slug = slugify(article.title)[:200] or f"story-{uuid.uuid4().hex[:8]}"
            base_slug = slug
            counter = 1
            while Story.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            has_primary = getattr(article.source, 'source_type', 'news') == 'primary'
            # New story: 1 source, no velocity yet → always starts as WIRE
            status = compute_tier(1, 0.0, has_primary)

            story = Story.objects.create(
                title=article.title,
                slug=slug,
                summary=article.excerpt,
                first_seen_at=article.published_date,
                source_count=1,
                independent_count=1,
                status=status,
                velocity_score=0.0,
                embedding=article.embedding,
            )
            story.categories.set(article.categories.all())

            article.story = story
            article.is_primary_source = True  # Sole article in a new cluster.
            article.save(update_fields=['story', 'embedding', 'is_primary_source'])

            return story
