from django.contrib import admin
from django.urls import path, include
from api.api import api

urlpatterns = [
    path('admin/', admin.site.urls),
    # V3: Versioned API endpoint
    path("api/v1/", api.urls),
]
