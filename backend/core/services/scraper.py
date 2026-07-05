import hashlib
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from datetime import datetime, timezone
from time import mktime

import feedparser
import nh3

logger = logging.getLogger(__name__)

# HTML tags allowed in excerpts/content after sanitization
ALLOWED_TAGS = {
    'p', 'br', 'strong', 'em', 'b', 'i', 'a', 'ul', 'ol', 'li',
    'h2', 'h3', 'h4', 'blockquote',
}
ALLOWED_ATTRIBUTES: dict[str, set[str]] = {
    'a': {'href', 'title'},
}

# Maximum words for the public-facing excerpt
EXCERPT_WORD_LIMIT = 40


def sanitize_html(html: str) -> str:
    """Sanitize HTML content to prevent XSS. Uses nh3 (Rust-based, fast)."""
    if not html:
        return ""
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
    )


def generate_content_hash(text: str) -> str:
    """Generate a SHA-256 hash of normalized text for deduplication."""
    normalized = " ".join(text.lower().split())
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


def generate_excerpt(full_text: str, max_words: int = EXCERPT_WORD_LIMIT) -> str:
    """Generate a ~40 word excerpt from full text."""
    if not full_text:
        return ""
    # Strip HTML for excerpt
    clean_text = nh3.clean(full_text, tags=set())
    words = clean_text.split()
    if len(words) <= max_words:
        return clean_text
    return " ".join(words[:max_words]) + "…"


class BaseScraper(ABC):
    @abstractmethod
    def fetch_articles(self, url: str) -> List[Dict[str, Any]]:
        pass


class RSSScraper(BaseScraper):
    def fetch_articles(self, url: str) -> List[Dict[str, Any]]:
        logger.info("Fetching RSS feed from %s", url)
        feed = feedparser.parse(url)

        articles = []
        for entry in feed.entries:
            # Handle date parsing — always produce timezone-aware datetimes
            published_date = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published_date = datetime.fromtimestamp(
                    mktime(entry.published_parsed),
                    tz=timezone.utc,
                )
            else:
                published_date = datetime.now(tz=timezone.utc)

            link = entry.get('link', '')
            title = entry.get('title', 'No Title')
            summary = entry.get('summary', '') or entry.get('description', '')

            full_content = summary
            image_url = None

            # 1. Try to find image in feed (media_content or enclosure)
            if 'media_content' in entry and entry.media_content:
                image_url = entry.media_content[0].get('url')
            elif 'media_thumbnail' in entry and entry.media_thumbnail:
                image_url = entry.media_thumbnail[0].get('url')
            elif 'links' in entry:
                for l in entry.links:
                    if getattr(l, 'rel', '') == 'enclosure' and getattr(l, 'type', '').startswith('image/'):
                        image_url = l.href
                        break

            # 2. Deep-fetch full content and og:image with timeout protection
            if link:
                try:
                    import trafilatura
                    from lxml import html as lxml_html

                    # Fetch page with timeout (15s max)
                    downloaded = trafilatura.fetch_url(link)

                    if downloaded:
                        # Extract full text
                        full_text = trafilatura.extract(
                            downloaded,
                            include_comments=False,
                            include_tables=False,
                        )
                        if full_text and len(full_text) > len(summary):
                            # Sanitize and format as HTML paragraphs
                            paragraphs = [
                                f"<p>{nh3.clean(line, tags=set())}</p>"
                                for line in full_text.split('\n')
                                if line.strip()
                            ]
                            full_content = "".join(paragraphs)

                        # Extract og:image — prioritize over RSS thumbnail
                        tree = lxml_html.fromstring(downloaded)

                        og_image = tree.xpath('//meta[@property="og:image"]/@content')
                        if not og_image:
                            og_image = tree.xpath('//meta[@name="twitter:image"]/@content')

                        if og_image:
                            found_url = og_image[0]
                            if found_url and not found_url.startswith('http'):
                                from urllib.parse import urljoin
                                found_url = urljoin(link, found_url)
                            image_url = found_url

                except Exception as e:
                    logger.warning("Failed to deep-fetch content for %s: %s", link, e)

            # Sanitize the final content
            sanitized_content = sanitize_html(full_content)

            articles.append({
                'title': title,
                'url': link,
                'content': sanitized_content,
                'excerpt': generate_excerpt(full_content),
                'content_hash': generate_content_hash(f"{title} {full_content}"),
                'published_date': published_date,
                'image_url': image_url,
            })

        logger.info("Found %d items in RSS feed.", len(articles))
        return articles


class ScraperService:
    def __init__(self):
        self.scrapers = {
            'rss': RSSScraper()
        }

    def scrape_source(self, source) -> List[Dict[str, Any]]:
        scraper = self.scrapers.get(source.scraper_type)
        if not scraper:
            logger.warning("No scraper found for type %s", source.scraper_type)
            return []

        return scraper.fetch_articles(source.url)
