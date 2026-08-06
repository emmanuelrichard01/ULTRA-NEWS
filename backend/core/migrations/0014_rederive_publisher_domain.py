from django.db import migrations


def rederive_publisher_domain(apps, schema_editor):
    """
    Re-derive every publisher domain using the Public Suffix List.

    Migration 0012 backfilled this column with a dot-counting implementation that
    got compound ccTLDs wrong — `theeastafrican.co.ke` was stored as `co.ke`, so
    every Kenyan outlet would have shared one publisher identity and stopped
    corroborating each other. Rows written by that pass have to be recomputed;
    new installs are unaffected but running this again is harmless.
    """
    from core.models import derive_publisher_domain

    Source = apps.get_model('core', 'Source')
    to_update = []
    for source in Source.objects.all().only('id', 'url', 'publisher_domain'):
        domain = derive_publisher_domain(source.url)
        if domain and source.publisher_domain != domain:
            source.publisher_domain = domain
            to_update.append(source)

    if to_update:
        Source.objects.bulk_update(to_update, ['publisher_domain'], batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_article_search_vector_trigger'),
    ]

    operations = [
        migrations.RunPython(rederive_publisher_domain, migrations.RunPython.noop),
    ]
