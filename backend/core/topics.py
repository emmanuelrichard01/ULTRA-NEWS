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
"""
import logging
from dataclasses import dataclass, field

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
