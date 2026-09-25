from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0020_story_momentum"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="video_url",
            field=models.URLField(blank=True, max_length=1000, null=True),
        ),
    ]
