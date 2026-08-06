from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Index for the corroboration filter.

    The feed now filters on independent_count (">= 2 outlets", ">= 3 outlets")
    while ordering by (first_seen_at, id). A composite index in that order lets
    Postgres satisfy the filter and the sort from one index scan instead of
    sorting the filtered set on every page request.
    """

    dependencies = [
        ('core', '0014_rederive_publisher_domain'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='story',
            index=models.Index(
                fields=['independent_count', '-first_seen_at', '-id'],
                name='story_corroboration_idx',
            ),
        ),
    ]
