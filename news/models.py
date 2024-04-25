from django.db import models

# Create your models here.


class Headline(models.Model):
    title = models.CharField(max_length=200)
    description = models.CharField(max_length=200)
    date = models.CharField(max_length=500)
    image = models.URLField(null=True, blank=True)
    url = models.TextField()

    def __str__(self):
        return self.title
