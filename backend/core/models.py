from django.db import models

class Source(models.Model):
    name = models.CharField(max_length=255)
    url = models.URLField(unique=True)
    scraper_type = models.CharField(max_length=50, default='rss')
    
    def __str__(self):
        return self.name

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name

class Article(models.Model):
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True, blank=True)
    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name='articles')
    url = models.URLField(unique=True)
    content = models.TextField(blank=True)
    published_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    categories = models.ManyToManyField(Category, related_name='articles', blank=True)

    def __str__(self):
        return self.title
