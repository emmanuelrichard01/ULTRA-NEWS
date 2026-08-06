"""
Semantic cache for Wire Room answers.

Every question previously went to the model, including the same question asked
twice. On a news product that is a poor bet: readers converge on whatever is
happening today, so the query distribution is extremely peaked — "what happened
in Gaza", "gaza latest", "what's going on in gaza" are one question, and each
was a separate paid generation with several seconds of latency.

Exact-string caching would barely help, because those three phrasings share no
key. Matching on the query EMBEDDING catches paraphrases, which is where the
repetition actually lives.

Two conditions must both hold for a hit:

  1. The stored query is semantically near the new one.
  2. The corpus hasn't moved underneath it. A cached answer about a developing
     story is wrong the moment new reporting lands, so entries are invalidated by
     a generation counter that ingestion bumps — a stale answer on a news product
     is worse than a slow one.
"""
import logging
import time

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cosine similarity above which two questions are treated as the same question.
# Deliberately strict: "Ukraine ceasefire talks" and "Ukraine drone strikes" sit
# around 0.85, and serving one answer for the other would be a factual error, not
# an approximation.
SEMANTIC_HIT_THRESHOLD = 0.95

# Entries live at most this long even if the corpus is quiet.
ANSWER_TTL_SECONDS = 30 * 60

# How many recent (embedding, answer) pairs to scan. Small on purpose — this is a
# linear scan in the request path, and the peak of the query distribution is
# narrow enough that a long tail adds latency without adding hits.
MAX_CACHED_ANSWERS = 60

_INDEX_KEY = "ask:cache:index"
_GENERATION_KEY = "ask:cache:generation"


def current_generation() -> int:
    """Corpus generation. Bumped whenever new reporting is clustered."""
    try:
        return int(cache.get(_GENERATION_KEY) or 0)
    except (TypeError, ValueError):
        return 0


def invalidate_all() -> None:
    """
    Retire every cached answer by advancing the generation.

    Called when clustering lands new articles. Advancing a counter is O(1) and
    leaves existing entries to expire on their own, rather than scanning and
    deleting keys on the ingest path.
    """
    try:
        cache.incr(_GENERATION_KEY)
    except ValueError:
        cache.set(_GENERATION_KEY, 1, timeout=None)


def _cosine(a: list[float], b: list[float]) -> float:
    import numpy as np

    va, vb = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(va @ vb / denom) if denom else 0.0


def lookup(query_vector: list[float]) -> dict | None:
    """Return a cached answer for a semantically equivalent question, or None."""
    try:
        index = cache.get(_INDEX_KEY) or []
    except Exception as e:
        logger.debug("Answer cache unavailable: %s", e)
        return None

    generation = current_generation()
    now = time.time()
    best, best_similarity = None, 0.0

    for entry in index:
        if entry.get("generation") != generation:
            continue
        if now - entry.get("stored_at", 0) > ANSWER_TTL_SECONDS:
            continue
        similarity = _cosine(query_vector, entry["vector"])
        if similarity >= SEMANTIC_HIT_THRESHOLD and similarity > best_similarity:
            best, best_similarity = entry, similarity

    from core.observability import answer_cache_events

    if best is None:
        answer_cache_events.labels("miss").inc()
        return None

    answer_cache_events.labels("hit").inc()
    logger.info("Answer cache hit (similarity=%.3f) for %r", best_similarity, best["query"][:60])
    return {
        "answer": best["answer"],
        "context_sources": best["context_sources"],
        "synthesis_type": best["synthesis_type"],
        "cached": True,
        "cached_similarity": round(best_similarity, 4),
    }


def store(query: str, query_vector: list[float], answer: str,
          context_sources: list[str], synthesis_type: str) -> None:
    """Record an answer for reuse by later paraphrases of the same question."""
    if not answer.strip():
        return

    entry = {
        "query": query[:200],
        "vector": [float(x) for x in query_vector],
        "answer": answer,
        "context_sources": context_sources,
        "synthesis_type": synthesis_type,
        "generation": current_generation(),
        "stored_at": time.time(),
    }

    try:
        index = cache.get(_INDEX_KEY) or []
        index.insert(0, entry)
        cache.set(_INDEX_KEY, index[:MAX_CACHED_ANSWERS], timeout=ANSWER_TTL_SECONDS * 2)
    except Exception as e:
        logger.debug("Could not store answer in cache: %s", e)
