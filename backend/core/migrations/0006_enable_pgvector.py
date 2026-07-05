from django.db import migrations
from pgvector.django import VectorExtension

class Migration(migrations.Migration):
    dependencies = [
        ('core', '0005_source_source_type_story_independent_count_and_more'),
    ]

    operations = [
        VectorExtension(),
    ]
