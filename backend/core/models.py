from django.db import models
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex
from pgvector.django import VectorField


class Source(models.Model):
    class SourceType(models.TextChoices):
        NEWS = 'news', 'News Outlet'
        PRIMARY = 'primary', 'Primary Source (Gov/Corporate)'

    name = models.CharField(max_length=255)
    url = models.URLField(unique=True)
    scraper_type = models.CharField(max_length=50, default='rss')
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.NEWS,
    )
    # V3: health tracking for the admin source dashboard
    is_active = models.BooleanField(default=True)
    fetch_interval_minutes = models.PositiveIntegerField(default=30)
    last_fetched_at = models.DateTimeField(null=True, blank=True)
    consecutive_failures = models.PositiveIntegerField(default=0)
    
    # V3 Phase 3: Trust Graph Metrics
    articles_broken_first = models.PositiveIntegerField(
        default=0, help_text="Number of times this source was the primary (earliest) article in a Corroborated story."
    )
    corroboration_rate = models.FloatField(
        default=0.0, help_text="Percentage of this source's articles that reach the Corroborated tier."
    )

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
        WIRE = 'wire', 'The Wire'            # 1 source, low velocity
        DEVELOPING = 'developing', 'Developing'      # 2 sources, or 1 source + high velocity
        CORROBORATED = 'corroborated', 'Reporting' # 3+ independent domains

    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True)
    summary = models.TextField(
        blank=True,
        help_text="AI-generated summary or lead paragraph. Clearly labeled in UI.",
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
    categories = models.ManyToManyField(Category, related_name='stories', blank=True)
    embedding = VectorField(dimensions=384, null=True, blank=True)
    # V3 Phase 3: centroid_embedding = VectorField(dimensions=768) — deferred

    class Meta:
        verbose_name_plural = "Stories"
        ordering = ['-first_seen_at']
        indexes = [
            models.Index(fields=['-first_seen_at'], name='story_first_seen_idx'),
            models.Index(fields=['status', '-first_seen_at'], name='story_status_idx'),
        ]

    def __str__(self):
        return self.title

    def update_status(self):
        """Recalculate status based on source count."""
        if self.source_count >= 3:
            self.status = self.Status.CORROBORATED
        else:
            self.status = self.Status.DEVELOPING

    def update_primary_source(self):
        """Flag the chronologically first article as the primary source."""
        earliest_article = self.articles.order_by('published_date').first()
        if earliest_article:
            # Mark all as not primary, then mark the earliest as primary
            self.articles.exclude(pk=earliest_article.pk).update(is_primary_source=False)
            if not earliest_article.is_primary_source:
                earliest_article.is_primary_source = True
                earliest_article.save(update_fields=['is_primary_source'])


class Article(models.Model):
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True, blank=True)
    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name='articles')
    url = models.URLField(unique=True)
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
            GinIndex(fields=['search_vector'], name='article_search_gin_idx'),
        ]

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
    url = models.URLField(unique=True)
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
