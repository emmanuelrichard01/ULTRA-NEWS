# news/views.py
from django.shortcuts import render, redirect
import requests
from bs4 import BeautifulSoup
from news.models import Headline
from django.http import JsonResponse
from django.core.paginator import Paginator

def home(request):
    headlines = Headline.objects.all().order_by('-id')
    paginator = Paginator(headlines, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    return render(request, 'news/index.html', {'object_list': page_obj})

def clear_database(request):
    if request.method == 'POST':
        Headline.objects.all().delete()
        return JsonResponse({'message': 'Database cleared successfully'})
    else:
        return JsonResponse({'error': 'Invalid request method'}, status=400)

def scrape(request):
    for page in range(1, 4):
        try:
            URL = f"https://www.naijanews.com/news/page/{page}"
            req = requests.get(URL)
            soup = BeautifulSoup(req.content, 'html.parser')
            main_section = soup.find("div", class_="mvp-main-blog-in")
            main_div = main_section.find("div", class_="mvp-main-blog-body")
            sub_div = main_div.find("ul", class_="mvp-blog-story-list")
            news = sub_div.find_all("li", class_="mvp-blog-story-wrap")

            for article in news:
                img = article.find('img', class_='mvp-reg-img')['src']
                link = article.find('a')['href']
                title = article.find('h2').get_text()
                date = article.find('span', class_='mvp-cd-date').get_text()
                description = article.find('p').get_text()[:500]  # Truncate if needed

                if not Headline.objects.filter(title=title, link=link).exists():
                    Headline.objects.create(
                        image=img,
                        title=title,
                        date=date,
                        link=link,
                        description=description
                    )
        except Exception as e:
            print(f"Scraping error on page {page}: {e}")
    return redirect('home')

# models.py - Headline.date and Headline.description changes suggested
# from django.db import models
# class Headline(models.Model):
#     title = models.CharField(max_length=500)
#     description = models.TextField()  # removed max_length=500
#     date = models.CharField(max_length=500)  # consider DateTimeField
#     image = models.URLField(null=True, blank=True)
#     link = models.TextField()

# index.html - Add fallback when no news is present:
# {% if object_list %}
#   ... (loop through articles)
# {% else %}
#   <p class="text-center">No news articles found. Click "Get News" above to scrape new headlines.</p>
# {% endif %}
