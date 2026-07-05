import re
import logging
import uuid
from typing import Protocol, List
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from core.models import Story, Article

try:
    from fastembed import TextEmbedding
    import numpy as np
except ImportError:
    TextEmbedding = None

logger = logging.getLogger(__name__)

_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None and TextEmbedding is not None:
        # 384-dimensional efficient model
        _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedding_model

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

class ExactTitleScorer:
    """What we had today. Kept only as the null baseline."""
    def similarity(self, candidate: Article, existing: Story) -> float:
        def normalize(t): return " ".join(t.lower().split())
        return 1.0 if normalize(candidate.title) == normalize(existing.title) else 0.0

class TokenOverlapScorer:
    """Ship this week. No ML infra, no new dependency, no API cost.
    Jaccard similarity on stemmed titles within a 72-hour window."""
    
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
            
        # Jaccard index
        jaccard = len(a & b) / len(a | b)
        return jaccard

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
    Compute the Tier (Status) of a Story based on explicit rules.
    Velocity can pull a story into Developing early, but can never alone push a story into Reporting.
    """
    # Thresholds
    VELOCITY_THRESHOLD = 0.5  # sources per hour
    
    if independent_count >= 3:
        return Story.Status.CORROBORATED # Reporting
    
    if independent_count == 2 or (independent_count == 1 and velocity > VELOCITY_THRESHOLD):
        return Story.Status.DEVELOPING
        
    return Story.Status.WIRE

def cluster_article(article: Article, scorer: ClusterScorer = None) -> Story:
    """
    Assign an Article to an existing Story cluster or create a new one.
    """
    model = get_embedding_model()
    
    # Generate embedding for candidate article if not present
    if model and not article.embedding:
        text_to_embed = f"{article.title} {article.excerpt}"
        embeddings = list(model.embed([text_to_embed]))
        article.embedding = [float(x) for x in embeddings[0]]
        
    if scorer is None:
        if model:
            scorer = EmbeddingScorer()
        else:
            scorer = TokenOverlapScorer()
        
    with transaction.atomic():
        # Optimization: only check recent stories (e.g. last 7 days) in the same category
        recent_window = article.published_date - timedelta(days=7)
        candidate_stories = Story.objects.filter(
            first_seen_at__gte=recent_window
        ).prefetch_related('articles__source')
        
        best_match = None
        best_score = 0.0
        threshold = 0.80 if isinstance(scorer, EmbeddingScorer) else 0.35
        
        for story in candidate_stories:
            score = scorer.similarity(article, story)
            if score > best_score and score >= threshold:
                best_score = score
                best_match = story
                
        if best_match:
            # Add to existing cluster
            if not best_match.articles.filter(id=article.id).exists():
                article.story = best_match
                article.save(update_fields=['story'])
                
                # Update independent domain count
                domains = set()
                primary_found = False
                for art in best_match.articles.all():
                    domains.add(art.source.url)
                    if getattr(art.source, 'source_type', 'news') == 'primary':
                        primary_found = True
                        
                best_match.independent_count = len(domains)
                
                # Update velocity (sources per hour)
                hours_alive = (timezone.now() - best_match.first_seen_at).total_seconds() / 3600.0
                if hours_alive > 0:
                    best_match.velocity_score = best_match.independent_count / hours_alive
                else:
                    best_match.velocity_score = best_match.independent_count
                
                # Compute Tier
                best_match.status = compute_tier(best_match.independent_count, best_match.velocity_score, primary_found)
                
                # Update source_count
                best_match.source_count = best_match.articles.count()
                
                best_match.last_updated_at = timezone.now()
                best_match.save()
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
            status = compute_tier(1, 1.0, has_primary) # brand new, 1 source, velocity 1.0 (assuming immediate)

            story = Story.objects.create(
                title=article.title,
                slug=slug,
                summary=article.excerpt,
                first_seen_at=article.published_date,
                source_count=1,
                independent_count=1,
                status=status,
                velocity_score=1.0,
                embedding=article.embedding,
            )
            story.categories.set(article.categories.all())
            
            article.story = story
            article.save(update_fields=['story'])
            
            return story
