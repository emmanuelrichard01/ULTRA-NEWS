from django.db import models

# Create your models here.


class Headline(models.Model):
    title = models.CharField(max_length=500)
    description = models.TextField(max_length=500)
    date = models.DateTimeField()
    image = models.URLField(null=True, blank=True)
    link = models.TextField()

    def __str__(self):
        return self.title
