from django.core.management.base import BaseCommand
from news.models import Headline # Replace "myapp" with the name of your app

class Command(BaseCommand):
    help = 'Clears the database'

    def handle(self, *args, **options):
        Headline.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('Database cleared successfully'))
