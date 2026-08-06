from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations
from pgvector.django import HnswIndex


class Migration(migrations.Migration):
    """
    ANN indexes for every vector search path.

    Until now there was no vector index of any kind, so `ORDER BY embedding <=>
    query LIMIT n` fell back to a sequential scan that computed cosine distance
    against every row. Measured on a 443-story table:

        Seq Scan on core_story ... rows=443 ... 127ms

    Clustering runs that query once per incoming article, so a 500-article batch
    spent roughly a minute inside vector scans alone — and the cost grows
    linearly with the archive. At 50k stories the same lookup is ~14 seconds,
    which makes ingestion impossible long before the dataset is interesting.

    HNSW rather than IVFFlat: it needs no training step and no
    rebuild-as-data-grows, which matters for a table that is continuously
    appended to by a background worker. m/ef_construction are pgvector's
    defaults — good recall at this scale without a slow build.

    Built CONCURRENTLY so an existing deployment isn't write-locked during the
    migration; this is why the migration is non-atomic.
    """

    atomic = False

    dependencies = [
        ('core', '0015_story_corroboration_index'),
    ]

    operations = [
        # Clustering: match an incoming article against recent story centroids.
        AddIndexConcurrently(
            model_name='story',
            index=HnswIndex(
                name='story_embedding_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ),
        # /ask RAG retrieval over article vectors.
        AddIndexConcurrently(
            model_name='article',
            index=HnswIndex(
                name='article_embedding_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ),
    ]
