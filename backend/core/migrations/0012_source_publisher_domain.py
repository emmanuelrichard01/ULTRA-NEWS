from django.db import migrations, models

from core.models import derive_publisher_domain


def backfill_publisher_domain(apps, schema_editor):
    """Derive the registrable domain for every existing source."""
    Source = apps.get_model('core', 'Source')
    to_update = []
    for source in Source.objects.all().only('id', 'url', 'publisher_domain'):
        domain = derive_publisher_domain(source.url)
        if domain and source.publisher_domain != domain:
            source.publisher_domain = domain
            to_update.append(source)
    if to_update:
        Source.objects.bulk_update(to_update, ['publisher_domain'], batch_size=500)


def clear_publisher_domain(apps, schema_editor):
    """No-op reverse — the column is dropped by the schema operation."""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_source_trust_tier_story_ai_summary_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='source',
            name='publisher_domain',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text=(
                    'Registrable domain identifying the publisher. Multiple feeds from one '
                    'newsroom share a domain and count as a SINGLE independent source.'
                ),
                max_length=255,
            ),
        ),
        migrations.RunPython(backfill_publisher_domain, clear_publisher_domain),
    ]
