from django.shortcuts import render
import requests
from requests import get
from bs4 import BeautifulSoup
from csv import writer
from time import time, sleep
from random import randint
from requests.api import head
from IPython.core.display import clear_output
from warnings import warn
from news.models import Headline

# requests.packages.urllib3.disable_warnings()


def scrape(request):

    # Prepare the loop
    # start_time = time()
    # requests = 0

    # pages = [str(i) for i in range(1, 5)]
    # # For every page in the interval 1-4
    # for page in pages:

    for page in range(1,2):
        URL = ("https://www.naijanews.com/news/page/")
        req = requests.get(URL + str(page))
        # Make a get request
        # Exp: https://www.imdb.com/search/title/?release_date=2019&sort=num_votes,desc&page=1
        # ("https://www.naijanews.com/news/page/")

        # # Pause the loop
        # sleep(randint(8, 15))

        # # Monitor the requests
        # request += 1
        # elapsed_time = time() - start_time
        # print('Request:{}; Frequency: {} requests/s'.format(request, request/elapsed_time))
        # clear_output(wait=True)

        # # Throw a warning for non-200 status codes
        # if req.status_code != 200:
        #     warn('Request: {}; Status code: {}'.format(
        #         request, req.status_code))

        # # Break the loop if the number of requests is greater than expected
        # # 4 pages * 10 years = 40 requests
        # if request > 40:
        #     warn('Number of requests was greater than expected.')
        #     break

    # URL = ("https://www.naijanews.com/news/page/")

    # for page in range(1, 2):
    #     req = requests.get(URL + str(page))
        soup = BeautifulSoup(req.content, 'html5lib')
        main_section = soup.find("div", attrs={"class": "mvp-main-blog-in"})
        main_div = main_section.find(
            "div", attrs={"class": "mvp-main-blog-body"})
        sub_div = main_div.find(
            "ul", attrs={"class": "mvp-blog-story-list"})
        news = sub_div.findAll("li", attrs={"class": "mvp-blog-story-wrap"})

        with open('news_articles.csv', 'w',encoding="utf-8") as csv_file:
            csv_writer = writer(csv_file)
            headers = ['Date', 'Title', 'ImageLink', 'Link', 'Description']
            csv_writer.writerow(headers)

            for article in news:
                img = article.find('img', class_='mvp-reg-img', src=True)['data-src']
                link = article.find('a', href=True)['href']
                title = article.find('h2').get_text()
                date = article.find('span', class_='mvp-cd-date left relative').get_text()
                description = article.find('p').get_text()
                # print(img['src'])
                # print(title.text)
                # print(link['href'])
                # print(date.text)
                # print(description.text)
                # print('-'*60)
                new_headline = Headline()
                new_headline.title = title.encode('utf-8')
                new_headline.url = link
                new_headline.image = img
                new_headline.date = date
                new_headline.description = description
                new_headline.save()
                csv_writer.writerow([date, title, img, link, description])
                # my_filters = {
                #     'date': '9 hours ago',
                #     'date': '10 hours ago',
                #     'date': '12 hours ago',
                #     'date': '14 hours ago',
                #     'date': '16 hours ago',
                # }
                # filter(**my_filters)
                headlines = Headline.objects.all()
                details = {
                    'object_list': headlines
                }
    return render(request, "news/index.html", details)


# def news_list(req):
#     headlines = Headline.objects.all()
#     context = {
#         'object_list': headlines,
#     }
#     return render(req, "news/index.html", context)
