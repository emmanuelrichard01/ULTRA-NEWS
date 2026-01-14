import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from datetime import datetime
from time import mktime
import feedparser

logger = logging.getLogger(__name__)

class BaseScraper(ABC):
    @abstractmethod
    def fetch_articles(self, url: str) -> List[Dict[str, Any]]:
        pass

class RSSScraper(BaseScraper):
    def fetch_articles(self, url: str) -> List[Dict[str, Any]]:
        logger.info(f"Fetching RSS feed from {url}")
        feed = feedparser.parse(url)
        
        articles = []
        for entry in feed.entries:
            # Handle date parsing
            published_date = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published_date = datetime.fromtimestamp(mktime(entry.published_parsed))
            else:
                published_date = datetime.now()

            link = entry.get('link', '')
            title = entry.get('title', 'No Title')
            summary = entry.get('summary', '') or entry.get('description', '')
            
            content = summary
            image_url = None
            
            # 1. Try to find image in feed (media_content or enclosure)
            if 'media_content' in entry:
                image_url = entry.media_content[0]['url']
            elif 'media_thumbnail' in entry:
                image_url = entry.media_thumbnail[0]['url']
            elif 'links' in entry:
                for l in entry.links:
                    if l.rel == 'enclosure' and l.type.startswith('image/'):
                        image_url = l.href
                        break
            
            # 2. Advanced: Fetch full content and og:image if missing or content is short
            # Only do this if we really need "professional" content (400+ words)
            # This is slower, so maybe limit to top items or async task?
            # For now, let's do it for every item but with a timeout to be safe.
            if link:
                try:
                    import trafilatura
                    import requests
                    from lxml import html
                    
                    # Fetch page
                    downloaded = trafilatura.fetch_url(link)
                    
                    if downloaded:
                        # Extract full text
                        full_text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
                        if full_text and len(full_text) > len(summary):
                            # Convert newlines to HTML paragraphs for basic formatting
                            content = "".join([f"<p>{line}</p>" for line in full_text.split('\n') if line.strip()])
                        
                        # Extract og:image if we didn't find one in RSS
                        if not image_url:
                            tree = html.fromstring(downloaded)
                            og_image = tree.xpath('//meta[@property="og:image"]/@content')
                            if og_image:
                                image_url = og_image[0]
                except Exception as e:
                    logger.error(f"Failed to scrape full content for {link}: {e}")

            articles.append({
                'title': title,
                'url': link,
                'content': content,
                'published_date': published_date,
                'image_url': image_url
            })
            
        logger.info(f"Found {len(articles)} items in RSS feed.")
        return articles

class ScraperService:
    def __init__(self):
        self.scrapers = {
            'rss': RSSScraper()
        }

    def scrape_source(self, source) -> List[Dict[str, Any]]:
        scraper = self.scrapers.get(source.scraper_type)
        if not scraper:
            logger.warning(f"No scraper found for type {source.scraper_type}")
            return []
        
        return scraper.fetch_articles(source.url)
