"""
Retrieval for the Wire Room's question answering.

The previous implementation took the five articles nearest the query vector and
fed their headlines and 40-word excerpts to the model. Three problems with that,
all of which show up immediately on real data:

  1. **Article-level retrieval collapses diversity.** A well-covered event has a
     dozen near-identical articles, so all five slots fill with one story and
     everything else the reader might have been asking about is crowded out.
     Retrieval should return five *stories*, not five articles.

  2. **No recency preference.** News answers are time-sensitive; a six-day-old
     article ranked identically to one filed an hour ago.

  3. **Corroboration was ignored.** This product's entire claim is that
     multi-outlet agreement means something — then grounded its answers without
     reference to it, so a single-source report could outrank a story six
     independent outlets agree on.

Retrieval now over-fetches at article level, groups into stories, and reranks on
similarity, corroboration and recency together.
"""
import logging
import math
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional

from django.utils import timezone

logger = logging.getLogger(__name__)

# Articles pulled from the vector index before grouping. Wide enough that a
# heavily-covered event can't crowd out every other story in the shortlist.
ARTICLE_FANOUT = 40

# Stories handed to the model as grounding context.
STORY_CONTEXT_LIMIT = 4

# Headlines shown per story, to convey how outlets framed it without flooding
# the prompt.
HEADLINES_PER_STORY = 3

# Excerpt characters per outlet in the grounding context. Enough for the lede
# sentence, which is where wire copy puts the who/what/where.
EXCERPT_CHARS = 280

# A story-scoped question ("Ask about this story") gets the whole cluster rather
# than three headlines: the reader is already looking at the story and wants
# what its coverage says, outlet by outlet.
SCOPED_HEADLINES = 10
SCOPED_RELATED = 2

# Recency half-life. A story twice this old contributes a quarter of the boost.
RECENCY_HALF_LIFE_HOURS = 36.0

# Weights for the rerank. Similarity dominates — corroboration and recency break
# ties among things that are already relevant, rather than dragging in
# well-corroborated stories that don't answer the question.
W_SIMILARITY = 1.0
W_CORROBORATION = 0.15
W_RECENCY = 0.20


@dataclass
class RetrievedStory:
    story_id: int
    slug: str
    title: str
    summary: str
    independent_count: int
    first_seen_at: object
    similarity: float
    score: float
    headlines: list[tuple[str, str]]  # (outlet, headline)
    # One excerpt per outlet, trimmed. Headlines alone tell the model how a story
    # was framed; they rarely carry the number, the name or the place a reader
    # is actually asking about.
    excerpts: list[tuple[str, str]] = field(default_factory=list)
    image_url: Optional[str] = None

    @property
    def outlets(self) -> list[str]:
        seen, ordered = set(), []
        for outlet, _headline in self.headlines:
            if outlet not in seen:
                seen.add(outlet)
                ordered.append(outlet)
        return ordered


def _recency_weight(first_seen_at) -> float:
    """Exponential decay on age, in [0, 1]."""
    age_hours = max((timezone.now() - first_seen_at).total_seconds() / 3600.0, 0.0)
    return math.exp(-age_hours / RECENCY_HALF_LIFE_HOURS)


def _corroboration_weight(independent_count: int) -> float:
    """
    Diminishing returns on outlet count.

    The step from one outlet to three is the meaningful one; three to thirty adds
    little confidence and shouldn't dominate the ranking.
    """
    return math.log1p(max(independent_count, 0)) / math.log(10)


def retrieve_stories(query_vector, limit: int = STORY_CONTEXT_LIMIT) -> list[RetrievedStory]:
    """
    Find the stories most worth grounding an answer in.

    Over-fetches articles, groups them into their story clusters, then reranks on
    similarity, corroboration and recency.
    """
    from pgvector.django import CosineDistance

    from core.models import Article, Source

    candidates = list(
        Article.objects.filter(
            embedding__isnull=False,
            story__isnull=False,
            source__trust_tier=Source.TrustTier.AUTO_PUBLISH,
        )
        .annotate(_distance=CosineDistance('embedding', query_vector))
        .select_related('story', 'source')
        .order_by('_distance')[:ARTICLE_FANOUT]
    )

    if not candidates:
        return []

    grouped: dict[int, dict] = {}
    for article in candidates:
        story = article.story
        similarity = 1.0 - float(article._distance)

        bucket = grouped.setdefault(story.id, {
            'story': story,
            'similarity': similarity,   # best-matching article represents the story
            'headlines': [],
            'excerpts': [],
            'image_url': None,
        })
        bucket['similarity'] = max(bucket['similarity'], similarity)
        _collect(bucket, article, HEADLINES_PER_STORY)

    retrieved = []
    for bucket in grouped.values():
        story = bucket['story']
        score = (
            W_SIMILARITY * bucket['similarity']
            + W_CORROBORATION * _corroboration_weight(story.independent_count)
            + W_RECENCY * _recency_weight(story.first_seen_at)
        )
        retrieved.append(RetrievedStory(
            story_id=story.id,
            slug=story.slug,
            title=story.title,
            summary=story.summary or "",
            independent_count=story.independent_count,
            first_seen_at=story.first_seen_at,
            similarity=bucket['similarity'],
            score=score,
            headlines=bucket['headlines'],
            excerpts=bucket['excerpts'],
            image_url=bucket['image_url'],
        ))

    retrieved.sort(key=lambda r: -r.score)
    return retrieved[:limit]


def _collect(bucket: dict, article, max_headlines: int) -> None:
    """Add one article's headline, excerpt and image to a story bucket."""
    outlet = article.source.name
    if len(bucket['headlines']) < max_headlines:
        bucket['headlines'].append((outlet, article.title))
    excerpt = (article.excerpt or "").strip()
    if (
        excerpt
        and len(bucket['excerpts']) < max_headlines
        and outlet not in {o for o, _ in bucket['excerpts']}
    ):
        bucket['excerpts'].append((outlet, _trim(excerpt, EXCERPT_CHARS)))
    if bucket['image_url'] is None and getattr(article, 'image_url', None):
        bucket['image_url'] = article.image_url


def _trim(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(",;:—-") + "…"


def retrieve_for_story(story_slug: str, query_vector) -> list[RetrievedStory]:
    """
    Grounding for a question asked FROM a story page.

    The scoped story always comes first, with its whole cluster rather than the
    usual three headlines — a reader who opened "Ask about this story" is asking
    about this story, and a better-scoring neighbour must not displace it. A
    couple of nearby stories follow, because the honest answer to "is this
    connected to X?" needs X in the context.

    Returns [] for an unknown slug; the caller falls back to open retrieval.
    """
    from core.models import Article, Source, Story

    story = Story.objects.filter(slug=story_slug).first()
    if story is None:
        return []

    articles = (
        Article.objects.filter(
            story=story, source__trust_tier=Source.TrustTier.AUTO_PUBLISH,
        )
        .select_related('source')
        .order_by('published_date', 'id')
    )
    bucket = {'headlines': [], 'excerpts': [], 'image_url': None}
    for article in articles:
        _collect(bucket, article, SCOPED_HEADLINES)

    scoped = RetrievedStory(
        story_id=story.id,
        slug=story.slug,
        title=story.title,
        summary=story.summary or "",
        independent_count=story.independent_count,
        first_seen_at=story.first_seen_at,
        similarity=1.0,
        score=float('inf'),
        headlines=bucket['headlines'],
        excerpts=bucket['excerpts'],
        image_url=bucket['image_url'],
    )

    neighbours = [
        s for s in retrieve_stories(query_vector, limit=SCOPED_RELATED + 1)
        if s.story_id != story.id
    ][:SCOPED_RELATED]
    return [scoped, *neighbours]


def citations(stories: list[RetrievedStory]) -> list[dict]:
    """
    The citation table sent to the client alongside an answer.

    Numbered to match the `[n]` markers in the context and therefore in the
    answer, so every `[2]` the reader sees resolves to a real story they can
    open — with its corroboration count attached, because a citation to a
    single unconfirmed report is a different thing from a citation to a story
    eight newsrooms stand behind, and the reader should see which it is.
    """
    return [
        {
            "n": i,
            "slug": s.slug,
            "title": s.title,
            "independent_count": s.independent_count,
            "outlets": s.outlets[:6],
            "first_seen_at": s.first_seen_at.isoformat() if s.first_seen_at else None,
            "image_url": s.image_url,
        }
        for i, s in enumerate(stories, start=1)
    ]


def build_extractive_answer(stories: list[RetrievedStory]) -> str:
    """
    An answer assembled from retrieved stories, with no model involved.

    This is the floor the feature never drops below. It's used when no API key
    is configured, and — more importantly — when the model call fails: hosted
    models return transient 503s, and by that point retrieval has already
    succeeded, so we are holding everything needed to give a useful answer. The
    old behaviour showed "Synthesis is temporarily unavailable" while sitting on
    exactly this data.
    """
    if not stories:
        return "Nothing on the wire matches that question yet."

    lines = ["Here is what the wire currently holds:\n"]
    for n, story in enumerate(stories, start=1):
        outlets = story.independent_count
        confidence = (
            f"corroborated by {outlets} independent outlets" if outlets >= 3
            else f"reported by {outlets} independent outlets" if outlets == 2
            else "single source, not independently confirmed"
        )
        lines.append(f"**{story.title}** — {confidence}. [{n}]")
        if story.summary and story.summary != story.title:
            lines.append(story.summary)
        if story.outlets:
            lines.append(f"_Sources: {', '.join(story.outlets[:5])}_")
        lines.append("")

    return "\n".join(lines).strip()


def build_context(stories: list[RetrievedStory]) -> str:
    """
    Render retrieved stories as grounding context.

    Corroboration and age are stated explicitly so the model can qualify its
    answer — "one outlet reports" versus "six independent outlets agree" is
    exactly the distinction this product exists to make, and it can only be drawn
    if the evidence reaches the prompt.
    """
    blocks = []
    now = timezone.now()

    for i, story in enumerate(stories, start=1):
        age = now - story.first_seen_at
        if age < timedelta(hours=1):
            age_text = "under an hour ago"
        elif age < timedelta(days=1):
            age_text = f"{int(age.total_seconds() // 3600)} hours ago"
        else:
            age_text = f"{age.days} days ago"

        outlets = story.independent_count
        confidence = (
            f"{outlets} independent outlets corroborate this"
            if outlets >= 3 else
            f"{outlets} independent outlets report this"
            if outlets == 2 else
            "SINGLE SOURCE — not independently confirmed"
        )

        lines = [
            f"[{i}] {story.title}",
            f"  First reported: {age_text}",
            f"  Corroboration: {confidence}",
        ]
        if story.summary:
            lines.append(f"  Summary: {story.summary}")
        if story.headlines:
            lines.append("  How outlets headlined it:")
            lines.extend(f"    - {outlet}: {headline}" for outlet, headline in story.headlines)
        if story.excerpts:
            lines.append("  What the coverage says:")
            lines.extend(f"    - {outlet}: {excerpt}" for outlet, excerpt in story.excerpts)
        blocks.append("\n".join(lines))

    return "\n\n".join(blocks)
