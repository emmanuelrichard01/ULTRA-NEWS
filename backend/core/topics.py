"""
Topic classification by semantic similarity.

Replaces keyword matching, which on a 619-article corpus left 47% of articles
with no topic at all, put 2 articles in "art", and filed "Hong Kong can look to
San Francisco" under Technology. The failure is structural rather than a matter
of tuning the word lists:

  - Keywords match tokens, not meaning. A politics story mentioning Google once
    scores as Technology; a technology story that happens to avoid the listed
    vocabulary scores as nothing.
  - It ran over `title + content`, where content is the full article body, so a
    single passing mention anywhere in the text was enough to assign a topic.
  - Requiring two keyword hits meant short headlines — most of them — matched
    nothing, which is where the 47% came from.

Every article already has a 384-dimensional embedding computed for clustering.
Comparing it against embedded topic prototypes costs one dot product per topic,
needs no new dependency and no API call, gives a confidence score, and degrades
gracefully on vocabulary it has never seen.

Prototypes are written as natural-language descriptions of what belongs in the
topic, because that is what the embedding model was trained to compare against —
not as bags of keywords.

Two signals, then a vote
------------------------
Semantic similarity alone stalls on short headlines. bge-small puts them in a
narrow band, so "Anthropic's founders seek voting control ahead of IPO" scores
tech 0.545, business 0.540, politics 0.538: flat, correctly gated out, and
untagged. Measured on the live front page, 28% of stories carried no topic.

The missing signal was already in every article: the publisher filed it. An
editor put the piece under /business/ or /sport/, the feed it came from is
/news/tech/rss.xml, the RSS item carries <category>Business</category>, and
TechCrunch covers technology whatever the headline says. Those are
human-assigned labels, free and unaffected by headline length.
`editorial_hints` reads them; `topic_evidence` adds them to the semantic
signal, so either one can decide a clear case and both must agree on a close
one.

Stories are then topiced by consensus, not union. Unioning every article's
tags meant a story's topics only ever grew: one outlet's off-angle take added
a tag for good, and the "primary" topic shown on cards was whichever the
database returned first. `story_topics` sums the evidence one vote per
publisher, names a primary, and keeps a second topic only when it is nearly as
strong.
"""
import logging
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Assign at most this many topics. Stories are about something; a piece tagged
# five ways is a piece the classifier is unsure about.
MAX_TOPICS_PER_ARTICLE = 2

# Classification is argmax gated on DISTINCTIVENESS, not on absolute similarity.
#
# The absolute cosine score is worthless as a gate here. Measured against these
# prototypes:
#
#     real headlines   top-1 = 0.474 – 0.735
#     noise/boilerplate top-1 = 0.584 – 0.688   ("Read more", "...", gibberish)
#
# Those ranges overlap almost entirely — "..." scores 0.688, higher than a real
# story about strikes in Kyiv at 0.474. bge-small maps short text into a narrow
# band, so "how similar is this to Technology" cannot tell content from filler.
# An earlier version of this file gated on absolute score and duly classified
# gibberish as Technology.
#
# What does separate them is how much the best topic stands out from the rest.
# Text genuinely about something peaks on one topic; filler scores flat across
# all nine:
#
#     real headlines    top-1 minus mean(rest) = 0.059 – 0.157
#     noise/boilerplate top-1 minus mean(rest) = 0.020 – 0.057
#
# A clean gap. The gate sits inside it, leaning toward recall — a missing topic
# is recoverable, and dropping real coverage is the failure that made the
# keyword matcher useless.
TOPIC_DISTINCTIVENESS_MIN = 0.055

# Absolute-score floor, kept only as a coarse sanity bound. The distinctiveness
# gate above is what actually does the work.
TOPIC_SCORE_FLOOR = 0.40
TOPIC_MATCH_THRESHOLD = TOPIC_SCORE_FLOOR

# A second topic is added only when it is nearly as strong as the best one,
# which dual-tags genuinely cross-cutting stories without smearing every article
# across the taxonomy.
SECONDARY_TOPIC_MARGIN = 0.012


@dataclass(frozen=True)
class Topic:
    slug: str
    name: str
    description: str
    #: Sentences describing what this topic covers. Embedded and averaged into a
    #: prototype vector. Several angles per topic beat one long sentence — it
    #: widens the region of embedding space the topic occupies.
    prototypes: tuple[str, ...] = field(default_factory=tuple)


TOPICS: tuple[Topic, ...] = (
    Topic(
        slug="world",
        name="World",
        description="Diplomacy, conflict, and international affairs.",
        prototypes=(
            "International diplomacy, treaties and relations between countries.",
            "Armed conflict, war, military action and peace negotiations.",
            "Humanitarian crises, refugees and international aid efforts.",
            "United Nations, foreign ministries and cross-border disputes.",
        ),
    ),
    Topic(
        slug="politics",
        name="Politics",
        description="Elections, government, policy and power.",
        prototypes=(
            "Elections, campaigns, voting and party politics.",
            "Government legislation, policy decisions and parliamentary debate.",
            "Presidents, prime ministers, cabinets and political appointments.",
            "Courts, judicial rulings and constitutional disputes.",
        ),
    ),
    Topic(
        slug="business",
        name="Business",
        description="Markets, companies, and the economy.",
        prototypes=(
            "Stock markets, share prices, investors and trading.",
            "Company earnings, mergers, acquisitions and corporate strategy.",
            "Inflation, interest rates, central banks and economic growth.",
            "Employment, wages, trade and industry regulation.",
        ),
    ),
    Topic(
        slug="tech",
        name="Technology",
        description="Software, hardware, AI and the digital world.",
        prototypes=(
            "Artificial intelligence, machine learning models and AI research.",
            "Software, apps, operating systems and programming.",
            "Consumer electronics, smartphones, chips and hardware launches.",
            "Cybersecurity, hacking, data breaches and online privacy.",
            "Social media platforms, internet regulation and big tech companies.",
        ),
    ),
    Topic(
        slug="science",
        name="Science",
        description="Research, discovery and the natural world.",
        prototypes=(
            "Scientific research, peer-reviewed studies and new discoveries.",
            "Space exploration, astronomy, rockets and planetary science.",
            "Physics, chemistry, biology and laboratory experiments.",
            "Archaeology, palaeontology and the history of life on Earth.",
        ),
    ),
    Topic(
        slug="climate",
        name="Climate",
        description="Environment, energy and the changing planet.",
        prototypes=(
            "Climate change, global warming and carbon emissions.",
            "Extreme weather, floods, wildfires, droughts and heatwaves.",
            "Renewable energy, fossil fuels and the energy transition.",
            "Conservation, biodiversity, pollution and ecosystems.",
        ),
    ),
    Topic(
        slug="health",
        name="Health",
        description="Medicine, public health and wellbeing.",
        prototypes=(
            "Diseases, outbreaks, epidemics and public health measures.",
            "Medical research, clinical trials, drugs and vaccines.",
            "Hospitals, doctors, healthcare systems and patient care.",
            "Mental health, nutrition, fitness and wellbeing.",
        ),
    ),
    Topic(
        slug="culture",
        name="Culture",
        description="Film, music, art and the cultural conversation.",
        prototypes=(
            "Film, television, streaming series and box office.",
            "Music, albums, artists, concerts and the recording industry.",
            "Books, literature, publishing and authors.",
            "Visual art, museums, exhibitions, theatre and design.",
            "Celebrities, awards ceremonies and popular culture.",
        ),
    ),
    Topic(
        slug="sports",
        name="Sports",
        description="Competition, athletes and the global arena.",
        prototypes=(
            "Football, soccer matches, leagues, clubs and transfers.",
            "Olympics, athletics, championships and international competition.",
            "Cricket, tennis, basketball, rugby and motorsport.",
            "Athletes, coaches, injuries, results and league standings.",
        ),
    ),
)

TOPICS_BY_SLUG = {t.slug: t for t in TOPICS}

# Cached prototype matrix: (n_topics, dim), L2-normalised so cosine similarity
# against a normalised article vector is a single matrix-vector product.
_prototype_matrix = None
_prototype_slugs: list[str] = []


def _build_prototypes():
    """Embed every topic prototype once and average per topic."""
    global _prototype_matrix, _prototype_slugs

    import numpy as np

    from core.clustering import get_embedding_model

    model = get_embedding_model()
    if model is None:
        return None, []

    slugs, vectors = [], []
    for topic in TOPICS:
        if not topic.prototypes:
            continue
        embedded = np.array(list(model.embed(list(topic.prototypes))), dtype=float)
        centroid = embedded.mean(axis=0)
        norm = np.linalg.norm(centroid)
        if norm == 0:
            continue
        slugs.append(topic.slug)
        vectors.append(centroid / norm)

    _prototype_matrix = np.vstack(vectors) if vectors else None
    _prototype_slugs = slugs
    logger.info("Built topic prototypes for %d topics.", len(slugs))
    return _prototype_matrix, _prototype_slugs


def get_prototypes():
    global _prototype_matrix
    if _prototype_matrix is None:
        return _build_prototypes()
    return _prototype_matrix, _prototype_slugs


def score_topics(embedding) -> list[tuple[str, float]]:
    """
    Score an article embedding against every topic prototype.

    Returns (slug, similarity) sorted best-first. Empty when embeddings are
    unavailable.
    """
    if embedding is None:
        return []

    import numpy as np

    matrix, slugs = get_prototypes()
    if matrix is None:
        return []

    vector = np.asarray(embedding, dtype=float)
    norm = np.linalg.norm(vector)
    if norm == 0:
        return []

    similarities = matrix @ (vector / norm)
    ranked = sorted(zip(slugs, similarities, strict=True), key=lambda pair: -pair[1])
    return [(slug, float(score)) for slug, score in ranked]


def distinctiveness(ranked: list[tuple[str, float]]) -> float:
    """
    How far the best topic stands out from the rest.

    This, not the raw similarity, is what distinguishes text about a subject
    from filler — see the measurements above TOPIC_DISTINCTIVENESS_MIN.
    """
    if len(ranked) < 2:
        return 0.0
    rest = [score for _slug, score in ranked[1:]]
    return ranked[0][1] - (sum(rest) / len(rest))


def classify(
    embedding,
    threshold: float = TOPIC_SCORE_FLOOR,
    min_distinctiveness: float = TOPIC_DISTINCTIVENESS_MIN,
) -> list[tuple[str, float]]:
    """
    Pick the topics for an article.

    Takes the best-scoring topic when it is distinctive enough to mean anything,
    then adds a second only when it is within SECONDARY_TOPIC_MARGIN of the
    first — genuinely cross-cutting stories get two tags, everything else gets
    one, and filler gets none.
    """
    ranked = score_topics(embedding)
    if not ranked or ranked[0][1] < threshold:
        return []
    if distinctiveness(ranked) < min_distinctiveness:
        return []

    chosen = [ranked[0]]
    for slug, score in ranked[1:MAX_TOPICS_PER_ARTICLE]:
        if (ranked[0][1] - score) <= SECONDARY_TOPIC_MARGIN:
            chosen.append((slug, score))
    return chosen


# ---------------------------------------------------------------------------
# Editorial signal
# ---------------------------------------------------------------------------

#: Section names publishers use, mapped to our topics. Matched as whole URL
#: path segments or whole tags, never as substrings: "/sport/" is a section,
#: "passport" is not. Deliberately absent: "news", "us-news", "uk-news", "local"
#: (domestic buckets, not beats), "security" (cyber or defence?), "life".
SECTION_TERMS: dict[str, str] = {
    **dict.fromkeys((
        "world", "international", "global", "foreign", "africa", "asia",
        "asia-pacific", "europe", "americas", "latin-america", "middle-east",
        "middleeast", "world-news", "worldnews", "diplomacy", "conflict",
    ), "world"),
    **dict.fromkeys((
        "politics", "political", "election", "elections", "government",
        "policy", "congress", "parliament", "white-house", "us-politics",
        "uk-politics", "politics-news", "campaign",
    ), "politics"),
    **dict.fromkeys((
        "business", "economy", "economics", "markets", "market", "finance",
        "money", "companies", "company", "industry", "banking", "investing",
        "personal-finance", "trade", "retail", "real-estate", "property",
        "business-news", "wealth", "startups", "work", "careers", "jobs",
    ), "business"),
    **dict.fromkeys((
        "technology", "tech", "ai", "artificial-intelligence", "gadgets",
        "cybersecurity", "internet", "digital", "apps", "software", "gaming",
        "games", "innovation", "tech-news", "mobile", "computing",
    ), "tech"),
    **dict.fromkeys((
        "science", "space", "research", "astronomy", "physics", "biology",
        "archaeology", "science-news",
    ), "science"),
    **dict.fromkeys((
        "climate", "environment", "climate-crisis", "climate-change", "energy",
        "weather", "sustainability", "green", "planet",
    ), "climate"),
    **dict.fromkeys((
        "health", "wellness", "medicine", "medical", "healthcare",
        "coronavirus", "covid", "wellbeing", "well-being", "mental-health",
        "nutrition", "fitness", "health-news",
    ), "health"),
    **dict.fromkeys((
        "culture", "entertainment", "arts", "art", "music", "film", "films",
        "movies", "tv", "television", "books", "lifestyle", "celebrity",
        "style", "fashion", "showbiz", "nollywood", "bollywood", "theatre",
        "food", "travel", "arts-and-culture", "tv-and-radio",
    ), "culture"),
    **dict.fromkeys((
        "sport", "sports", "football", "soccer", "cricket", "tennis", "nba",
        "nfl", "f1", "formula1", "formula-1", "rugby", "rugby-union", "golf",
        "boxing", "athletics", "olympics", "premier-league", "basketball",
        "baseball", "cycling", "motorsport", "mma", "sport-news",
    ), "sports"),
}

#: Single-beat publishers, by publisher_domain. A prior, not a verdict: the
#: weakest editorial signal, so The Verge's film review still lands in Culture
#: when the text clearly says so.
DOMAIN_BEATS: dict[str, str] = {
    "techcrunch.com": "tech",
    "theverge.com": "tech",
    "wired.com": "tech",
    "arstechnica.com": "tech",
    "technologyreview.com": "tech",
    "techcabal.com": "tech",
    "nature.com": "science",
    "phys.org": "science",
    "sciencedaily.com": "science",
    "politico.com": "politics",
}

# Evidence weights. Semantic evidence is scaled so 1.0 is the old
# distinctiveness gate, and a topic needs TOPIC_EVIDENCE_MIN in total. So the
# article's own section decides alone; a tag, feed section or beat decides
# unless the text clearly points elsewhere; a weak semantic lean alone
# decides nothing, as before.
HINT_WEIGHTS = {
    "article_section": 2.0,
    "tag": 1.5,
    "feed_section": 1.2,
    "beat": 1.0,
}
TOPIC_EVIDENCE_MIN = 1.0
#: A second topic is kept when it reaches this share of the first.
SECONDARY_TOPIC_SHARE = 0.7

_SEGMENT_SPLIT = re.compile(r"[-_]")
_FEED_SUFFIX = re.compile(r"\.(xml|rss|cms|atom|php|html?)$", re.IGNORECASE)


def _terms(segment: str, allow_parts: bool) -> set[str]:
    """Topic slugs named by one path segment or tag."""
    token = segment.strip().lower().replace(" ", "-").replace("&", "and")
    if not token or token.isdigit():
        return set()
    if token in SECTION_TERMS:
        return {SECTION_TERMS[token]}
    if not allow_parts:
        return set()
    parts = [p for p in _SEGMENT_SPLIT.split(token) if p]
    # A long hyphenated segment is a slug, and slugs are prose.
    if len(parts) > 3:
        return set()
    return {SECTION_TERMS[p] for p in parts if p in SECTION_TERMS}


def _path_sections(url: str, include_last: bool) -> set[str]:
    try:
        path = urlparse(url or "").path
    except ValueError:
        return set()
    segments = [s for s in path.split("/") if s]
    if not include_last:
        # The last segment of an article URL is its slug: prose, not a section.
        segments = segments[:-1]
    found: set[str] = set()
    for segment in segments[:4]:
        found |= _terms(_FEED_SUFFIX.sub("", segment), allow_parts=True)
    return found


def editorial_hints(
    article_url: str = "",
    feed_url: str = "",
    tags=(),
    publisher_domain: str = "",
) -> dict[str, float]:
    """
    Where the publisher filed this piece, as {topic: weight}.

    Strongest first: the article's own URL section (an editor's choice for
    this piece), its RSS categories, the section of the feed it arrived in,
    then the publisher's beat. Weights add across kinds, so a piece filed
    under /sport/ in a sport feed is more certain than either alone.
    """
    hints: dict[str, float] = {}

    def add(slugs, kind):
        for slug in slugs:
            hints[slug] = hints.get(slug, 0.0) + HINT_WEIGHTS[kind]

    add(_path_sections(article_url, include_last=False), "article_section")
    tag_topics: set[str] = set()
    for tag in list(tags or ())[:8]:
        if isinstance(tag, str) and len(tag) <= 40:
            tag_topics |= _terms(tag, allow_parts=len(tag.split()) <= 3)
    add(tag_topics, "tag")
    add(_path_sections(feed_url, include_last=True), "feed_section")
    beat = DOMAIN_BEATS.get((publisher_domain or "").lower().removeprefix("www."))
    if beat:
        add({beat}, "beat")
    return hints


def topic_evidence(embedding, hints: dict[str, float] | None = None) -> dict[str, float]:
    """
    Combined evidence per topic: semantic lean plus editorial hints.

    Semantic evidence for a topic is how far it stands above the mean across
    all topics, scaled so the old distinctiveness gate is 1.0, and capped at
    1.5 so a confident embedding can outvote a feed's coarse section but not
    the editor's filing of the piece itself. Filler, flat across every topic,
    contributes nothing.
    """
    evidence: dict[str, float] = {}
    ranked = score_topics(embedding) if embedding is not None else []
    if ranked and ranked[0][1] >= TOPIC_SCORE_FLOOR:
        mean = sum(score for _slug, score in ranked) / len(ranked)
        # top - mean(all) = (n-1)/n × (top - mean(rest)), so this divisor puts
        # the old gate (distinctiveness 0.055) at exactly 1.0.
        scale = TOPIC_DISTINCTIVENESS_MIN * (len(ranked) - 1) / len(ranked)
        for slug, score in ranked:
            value = (score - mean) / scale
            if value > 0:
                evidence[slug] = min(1.5, value)
    for slug, weight in (hints or {}).items():
        evidence[slug] = evidence.get(slug, 0.0) + weight
    return {slug: round(value, 3) for slug, value in evidence.items() if value >= 0.05}


def pick_topics(evidence: dict[str, float], minimum: float = TOPIC_EVIDENCE_MIN) -> list[str]:
    """Primary topic, plus a second only when it is nearly as strong."""
    ranked = sorted(evidence.items(), key=lambda kv: -kv[1])
    if not ranked or ranked[0][1] < minimum:
        return []
    chosen = [ranked[0][0]]
    for slug, value in ranked[1:MAX_TOPICS_PER_ARTICLE]:
        if value >= minimum and value >= ranked[0][1] * SECONDARY_TOPIC_SHARE:
            chosen.append(slug)
    return chosen


def story_topics(votes) -> list[str]:
    """
    A story's topics by consensus, one vote per publisher.

    `votes` is (publisher, evidence) per article. Each publisher contributes
    its strongest evidence per topic however many articles it filed, so a
    newsroom running six live-blog updates doesn't outvote five newsrooms
    with one piece each. The mean across publishers is then judged like a
    single article: primary first, a second only if nearly as strong.
    """
    per_publisher: dict[str, dict[str, float]] = {}
    for publisher, evidence in votes:
        best = per_publisher.setdefault(publisher, {})
        for slug, value in (evidence or {}).items():
            best[slug] = max(best.get(slug, 0.0), float(value))
    if not per_publisher:
        return []
    totals: dict[str, float] = {}
    for evidence in per_publisher.values():
        for slug, value in evidence.items():
            totals[slug] = totals.get(slug, 0.0) + value
    n = len(per_publisher)
    return pick_topics({slug: value / n for slug, value in totals.items()})


def topic_slugs(story) -> list[str]:
    """
    A story's topic slugs, primary first.

    Uses the prefetched `categories` when present. Many-to-many rows carry no
    order, so before primary_category existed the "main" topic a card showed
    was whichever row the database happened to return first.
    """
    cats = list(story.categories.all())
    primary = getattr(story, "primary_category_id", None)
    cats.sort(key=lambda c: (c.pk != primary, c.slug))
    return [c.slug for c in cats]
