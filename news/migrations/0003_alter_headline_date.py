# Generated by Django 5.0.4 on 2024-04-25 09:57

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('news', '0002_alter_headline_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='headline',
            name='date',
            field=models.CharField(max_length=500),
        ),
    ]
