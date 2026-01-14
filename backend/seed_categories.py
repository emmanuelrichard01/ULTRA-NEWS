from core.models import Category
categories = ['Tech', 'Politics', 'Business', 'Entertainment', 'Science', 'Art']
for cat_name in categories:
    Category.objects.get_or_create(name=cat_name, slug=cat_name.lower())
    print(f"Ensured category: {cat_name}")
