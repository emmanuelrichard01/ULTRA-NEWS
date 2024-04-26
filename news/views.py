from django.shortcuts import render
import requests
from bs4 import BeautifulSoup
from news.models import Headline
from django.http import JsonResponse

def clear_database(request):
    if request.method == 'POST':
        Headline.objects.all().delete()
        return JsonResponse({'message': 'Database cleared successfully'})
    else:
        return JsonResponse({'error': 'Invalid request method'}, status=400)

def scrape(request):
    news_items = []

    for page in range(1, 2, 3):
        URL = "https://www.naijanews.com/news/page/" + str(page)
        req = requests.get(URL)
        soup = BeautifulSoup(req.content, 'html.parser')
        main_section = soup.find("div", class_="mvp-main-blog-in")
        main_div = main_section.find("div", class_="mvp-main-blog-body")
        sub_div = main_div.find("ul", class_="mvp-blog-story-list")
        news = sub_div.find_all("li", class_="mvp-blog-story-wrap")

        for article in news:
            img = article.find('img', class_='mvp-reg-img')['data-src']
            link = article.find('a')['href']
            title = article.find('h2').get_text()
            date = article.find('span', class_='mvp-cd-date').get_text()
            description = article.find('p').get_text()

            news_item = Headline.objects.create(
                image=img,
                title=title,
                date=date,
                link=link,
                description=description
            )
            news_items.append(news_item)

    details = {'object_list': news_items}
    return render(request, 'news/index.html', details)