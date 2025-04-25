from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('scrape/', views.scrape, name='scrape'),
    path('clear-database/', views.clear_database, name='clear_database'),
]
