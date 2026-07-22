from django.contrib import admin
from django.urls import path
from api.api import api

from api.stream import breaking_news_stream

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/v1/stream", breaking_news_stream),
    # V3: Versioned API endpoint
    path("api/v1/", api.urls),
]
