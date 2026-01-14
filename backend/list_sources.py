import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Source

sources = Source.objects.all()
if not sources:
    print("No sources found.")
else:
    for s in sources:
        print(f"- {s.name}: {s.url}")
