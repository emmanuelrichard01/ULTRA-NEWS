from ninja import NinjaAPI, Schema
from typing import List
from core.models import Article
from django.shortcuts import get_object_or_404

api = NinjaAPI()

class SourceSchema(Schema):
    name: str

class ArticleSchema(Schema):
    title: str
    url: str
    published_date: str
    source: SourceSchema

@api.get("/health")
def health(request):
    return {"status": "ok"}

@api.get("/news", response=List[ArticleSchema])
def list_news(request):
    return Article.objects.select_related('source').all().order_by('-published_date')[:100]
