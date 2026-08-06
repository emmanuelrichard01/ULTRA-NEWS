import uuid
from urllib.parse import urlparse

from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from django.utils.text import slugify
from pgvector.django import HnswIndex, VectorField

try:
    import tldextract

    # Use the bundled Public Suffix List snapshot only. Left to its defaults,
    # tldextract fetches the live PSL on first use — an outbound request during
    # request handling, and a hard failure in a sandboxed container.
    #
    # cache_dir=None because there is nothing to cache with no remote list, and
    # the unprivileged container user has no writable cache path — leaving it set
    # emits a permission warning on every process start.
    _extractor = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)
except ImportError:  # pragma: no cover - exercised only in trimmed environments
    tldextract = None
    _extractor = None


def derive_publisher_domain(url: str) -> str:
    """
    Reduce a feed URL to the registrable domain that identifies its publisher.

    Corroboration is only meaningful across *independent* publishers, so two
    feeds from the same newsroom must collapse to one identity:

        https://feeds.bbci.co.uk/news/world/rss.xml   -> bbci.co.uk
        https://www.bbci.co.uk/news/tech/rss.xml      -> bbci.co.uk
        https://www.theeastafrican.co.ke/rss          -> theeastafrican.co.ke

    Resolved against the Public Suffix List rather than by counting dots. A
    hand-maintained list of compound suffixes cannot be complete, and every gap
    silently merges unrelated publishers into one identity — an earlier version
    of this function reduced `theeastafrican.co.ke` to `co.ke`, which would have
    made every Kenyan outlet the same source for corroboration purposes.

    Returns an empty string for unparseable input so callers can fall back to
    the feed URL rather than merging unrelated sources.
    """
    if not url:
        return ""

    host = (urlparse(url).hostname or "").lower().strip('.')
    if not host:
        return ""

    if _extractor is None:
        # Degraded fallback: keep the last two labels. Wrong for compound
        # suffixes, but tldextract is a hard requirement in requirements.txt.
        parts = host.split('.')
        return '.'.join(parts[-2:]) if len(parts) > 2 else host

    extracted = _extractor(host)
    if not extracted.domain or not extracted.suffix:
        return ""
    return f"{extracted.domain}.{extracted.suffix}"


class Source(models.Model):
    class SourceType(models.TextChoices):
        NEWS = 'news', 'News Outlet'
        PRIMARY = 'primary', 'Primary Source (Gov/Corporate)'

    class TrustTier(models.TextChoices):
        AUTO_PUBLISH = 'auto_publish', 'Auto Publish'
        REVIEW_QUEUE = 'review_queue', 'Review Queue'

    name = models.CharField(max_length=255)
    url = models.URLField(max_length=1000, unique=True)
    publisher_domain = models.CharField(
        max_length=255, blank=True, db_index=True,
        help_text=(
            "Registrable domain identifying the publisher. Multiple feeds from one "
            "newsroom share a domain and count as a SINGLE independent source."
        ),
    )
    scraper_type = models.CharField(max_length=50, default='rss')
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.NEWS,
    )
    trust_tier = models.CharField(
        max_length=20,
        choices=TrustTier.choices,
        default=TrustTier.REVIEW_QUEUE,
        help_text="Sources in review_queue require manual approval before articles appear in public feeds."
    )
    # Health tracking for the source dashboard and the circuit breaker.
    is_active = models.BooleanField(default=True)
    fetch_interval_minutes = models.PositiveIntegerField(default=30)
    last_fetched_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Last time a fetch was ATTEMPTED (success or failure).",
    )
    # Attempted and succeeded are tracked separately on purpose. Previously only
    # `last_fetched_at` existed and it was stamped even when the fetch failed, so
    # a source returning 404 for weeks still looked freshly fetched.
    last_success_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Last time this source returned a parseable feed.",
    )
    consecutive_failures = models.PositiveIntegerField(default=0)
    last_error = models.CharField(
        max_length=300, blank=True,
        help_text="Why the most recent fetch failed. Empty when healthy.",
    )
    deactivated_reason = models.CharField(
        max_length=300, blank=True,
        help_text="Set when the circuit breaker disables a persistently failing source.",
    )

    # Conditional-GET state. Sending these back lets a publisher answer 304 Not
    # Modified instead of retransmitting an unchanged feed — cheaper for us and
    # markedly better manners toward the outlets we depend on.
    etag = models.CharField(max_length=300, blank=True)
    last_modified = models.CharField(max_length=120, blank=True)
    
    # V3 Phase 3: Trust Graph Metrics
    articles_broken_first = models.PositiveIntegerField(
        default=0, help_text="Number of times this source was the primary (earliest) article in a Corroborated story."
    )
    corroboration_rate = models.FloatField(
        default=0.0, help_text="Percentage of this source's articles that reach the Corroborated tier."
    )

    def save(self, *args, **kwargs):
        # Derived from the feed URL only as a fallback. The registry may set this
        # explicitly, which matters whenever the feed is served from a different
        # host than the newsroom that wrote the articles — a syndication proxy
        # would otherwise register as its own publisher and let genuinely
        # independent outlets appear to corroborate each other.
        if not self.publisher_domain:
            self.publisher_domain = derive_publisher_domain(self.url)
            update_fields = kwargs.get('update_fields')
            if update_fields is not None and 'publisher_domain' not in update_fields:
                kwargs['update_fields'] = list(update_fields) + ['publisher_domain']
        super().save(*args, **kwargs)

    # Consecutive failures after which the circuit breaker deactivates a source.
    # Feeds have transient outages; ~6 hours of solid failure at the default
    # 30-minute cadence is a dead source, not a blip.
    FAILURE_THRESHOLD = 12

    @property
    def is_healthy(self) -> bool:
        return self.is_active and self.consecutive_failures == 0

    @property
    def independence_key(self) -> str:
        """
        Identity used for corroboration counting. Falls back to the feed URL so an
        unparseable source stays distinct rather than merging with everything else.
        """
        return self.publisher_domain or derive_publisher_domain(self.url) or self.url

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Story(models.Model):
    """
    V3: Represents a real-world event/story cluster.
    Multiple Articles from different sources can belong to one Story.
    This is the core V3 concept — "12 outlets covering the same event
    collapsed into one verified story."
    """
    class Status(models.TextChoices):
        WIRE = 'wire', 'The Wire'                    # 1 source, unverified
        DEVELOPING = 'developing', 'Developing'      # 2 independent sources confirming
        CORROBORATED = 'corroborated', 'Reporting'   # 3+ independent domains

    class SynthesisStatus(models.TextChoices):
        IDLE = 'idle', 'Idle'
        PENDING = 'pending', 'Synthesis Pending'
        COMPLETED = 'completed', 'Synthesis Completed'
        FAILED = 'failed', 'Synthesis Failed'

    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True)
    summary = models.TextField(
        blank=True,
        help_text="AI-generated summary or lead paragraph. Clearly labeled in UI.",
    )
    # V3.5 Structured AI Intelligence Brief
    ai_summary = models.JSONField(
        null=True, blank=True,
        help_text="Structured multi-source intelligence brief generated by Gemini."
    )
    synthesis_status = models.CharField(
        max_length=20,
        choices=SynthesisStatus.choices,
        default=SynthesisStatus.IDLE,
        db_index=True,
    )
    synthesized_at = models.DateTimeField(null=True, blank=True)
    synthesis_source_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of articles in cluster when last synthesized."
    )
    synthesis_independent_count = models.PositiveIntegerField(
        default=0,
        help_text=(
            "Independent publishers in cluster when last synthesized. This — not "
            "the article count — is what decides whether re-synthesis is worth "
            "paying for: a second article from an outlet already represented adds "
            "almost nothing to a multi-source brief, whereas a new outlet does."
        ),
    )
    first_seen_at = models.DateTimeField()
    last_updated_at = models.DateTimeField(auto_now=True)
    source_count = models.PositiveIntegerField(default=1, help_text="Total articles in cluster")
    independent_count = models.PositiveIntegerField(default=1, help_text="Unique independent domains in cluster")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.WIRE,
    )
    velocity_score = models.FloatField(
        default=0.0, db_index=True,
        help_text="Trending score based on accumulation rate of sources."
    )
    momentum_outlets = models.PositiveIntegerField(
        default=0,
        help_text=(
            "Independent publishers that published on this story inside the "
            "momentum window. Materialised, because computing it per request "
            "meant a filtered COUNT(DISTINCT) joined across every article of "
            "every story on the page."
        ),
    )
    momentum_computed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When momentum_outlets was last recomputed. Momentum DECAYS as "
                  "the window slides, so a stale value silently overstates it.",
    )
    categories = models.ManyToManyField(Category, related_name='stories', blank=True)
    embedding = VectorField(dimensions=384, null=True, blank=True)
    # V3 Phase 3: centroid_embedding = VectorField(dimensions=768) — deferred

    class Meta:
        verbose_name_plural = "Stories"
        ordering = ['-first_seen_at']
        indexes = [
            models.Index(fields=['-first_seen_at'], name='story_first_seen_idx'),
            models.Index(fields=['status', '-first_seen_at'], name='story_status_idx'),
            models.Index(fields=['-velocity_score', '-first_seen_at', '-id'], name='story_cursor_idx'),
            # Serves the corroboration filter ("2+ outlets", "3+ outlets")
            # together with the feed's chronological ordering.
            models.Index(
                fields=['independent_count', '-first_seen_at', '-id'],
                name='story_corroboration_idx',
            ),
            # Serves the Developing edition directly — the ordering it needs is
            # now a plain index scan rather than an aggregate over articles.
            models.Index(
                fields=['-momentum_outlets', '-last_updated_at', '-id'],
                name='story_momentum_idx',
                condition=models.Q(momentum_outlets__gt=0),
            ),
            # ANN index for clustering. Without it, matching one article against
            # story centroids is a sequential scan over the whole table.
            HnswIndex(
                name='story_embedding_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ]

    def __str__(self):
        return self.title

    def update_primary_source(self):
        """
        Flag the chronologically first article as the primary source — the outlet
        that broke the story. Feeds Source.articles_broken_first in the trust graph.

        Ordered by (published_date, id) so ties resolve deterministically; with
        published_date alone, feeds that publish on the same timestamp could swap
        the "first to report" credit between runs.
        """
        earliest_article = self.articles.order_by('published_date', 'id').first()
        if not earliest_article:
            return

        # Mark all as not primary, then mark the earliest as primary
        self.articles.exclude(pk=earliest_article.pk).update(is_primary_source=False)
        if not earliest_article.is_primary_source:
            self.articles.filter(pk=earliest_article.pk).update(is_primary_source=True)
            earliest_article.is_primary_source = True


class Article(models.Model):
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True, blank=True)
    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name='articles')
    url = models.URLField(max_length=1000, unique=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    # V3: excerpt-only model — short excerpt for display, full text in RawDocument
    excerpt = models.TextField(
        blank=True,
        help_text="~40 word excerpt for display. Full text stored in RawDocument.",
    )
    # Keep content field for backward compatibility during migration,
    # but new code should use excerpt for rendering
    content = models.TextField(blank=True)
    content_hash = models.CharField(
        max_length=64, blank=True, db_index=True,
        help_text="SHA-256 hash of normalized content for deduplication.",
    )
    published_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    categories = models.ManyToManyField(Category, related_name='articles', blank=True)
    # V3: Story clustering
    story = models.ForeignKey(
        Story, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='articles',
        help_text="The story cluster this article belongs to.",
    )
    is_primary_source = models.BooleanField(
        default=False,
        help_text="True if this was the earliest published report in the cluster."
    )
    # V3: Full-text search with stored vector + GIN index
    search_vector = SearchVectorField(null=True)
    embedding = VectorField(dimensions=384, null=True, blank=True)

    class Meta:
        ordering = ['-published_date']
        indexes = [
            models.Index(fields=['-published_date'], name='article_pub_date_idx'),
            models.Index(fields=['source', '-published_date'], name='article_source_pub_idx'),
            models.Index(
                fields=['story'],
                name='article_no_story_idx',
                condition=models.Q(story__isnull=True),
            ),
            GinIndex(fields=['search_vector'], name='article_search_gin_idx'),
            # Serves the "Developing" edition, which counts distinct publishers
            # whose article landed inside a recent window.
            models.Index(fields=['-created_at', 'story'], name='article_recent_idx'),
            # ANN index for /ask RAG retrieval.
            HnswIndex(
                name='article_embedding_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ]

    def save(self, *args, **kwargs):
        """
        Guarantee a unique slug.

        `slug` is unique *and* blank=True with no default, so every write path
        that didn't hand-roll a slug produced '' — and the second such row hit a
        UniqueViolation. Only the ingest task generated one, leaving the admin,
        shell, fixtures and tests to trip over it. Generating here makes the
        invariant hold no matter who writes the row.
        """
        if not self.slug:
            self.slug = self._build_unique_slug()
            update_fields = kwargs.get('update_fields')
            if update_fields is not None and 'slug' not in update_fields:
                kwargs['update_fields'] = list(update_fields) + ['slug']
        super().save(*args, **kwargs)

    def _build_unique_slug(self) -> str:
        base = slugify(self.title)[:180] or f"article-{uuid.uuid4().hex[:8]}"
        candidate = base
        # Bounded retries, then fall back to a guaranteed-unique suffix rather
        # than looping against a hot table.
        for _ in range(5):
            if not Article.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                return candidate
            candidate = f"{base}-{uuid.uuid4().hex[:6]}"
        return f"{base}-{uuid.uuid4().hex[:12]}"

    def __str__(self):
        return self.title


class RawDocument(models.Model):
    """
    V3: Stores the full extracted text privately for internal processing
    (embedding, clustering, summarization). Never rendered to end users.
    Per V3 architecture spec §13.1 — excerpt-only display model.
    """
    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name='raw_documents')
    article = models.OneToOneField(
        Article, on_delete=models.CASCADE,
        related_name='raw_document',
        null=True, blank=True,
    )
    url = models.URLField(max_length=1000, unique=True)
    raw_content = models.TextField(
        help_text="Full extracted text. Internal use only — AI processing, embeddings.",
    )
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['-fetched_at'], name='rawdoc_fetched_idx'),
        ]

    def __str__(self):
        return f"RawDocument: {self.url[:80]}"
