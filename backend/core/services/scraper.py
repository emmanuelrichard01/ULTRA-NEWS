import hashlib
import html
import logging
import random
import re
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from time import mktime, sleep
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urljoin

import feedparser
import httpx
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

# Network budget. The whole point of these limits is that one source's scrape has
# a predictable worst case, so the Celery task's time limit can be set to
# something that is actually achievable.
FEED_TIMEOUT_SECONDS = 10.0
ARTICLE_TIMEOUT_SECONDS = 8.0
DEEP_FETCH_CONCURRENCY = 8

# Cap on how many new articles we deep-fetch per source per run. A feed that
# suddenly publishes 200 items should not monopolise the worker.
MAX_DEEP_FETCH_PER_RUN = 25

# Refuse to buffer enormous responses into memory.
MAX_ARTICLE_BYTES = 4 * 1024 * 1024

USER_AGENT = (
    "Mozilla/5.0 (compatible; UltraNewsBot/3.0; +https://github.com/emmanuelrichard01/ULTRA-NEWS)"
)

# Transient transport failures — our side, or a momentary blip on theirs. These
# are retried rather than recorded against the source's health.
TRANSIENT_ERRORS = (
    httpx.ConnectError,      # DNS resolution failures under fan-out load
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.RemoteProtocolError,
)
FEED_FETCH_ATTEMPTS = 3
FEED_RETRY_BASE_DELAY = 0.6


def sanitize_html(html: str) -> str:
    """Sanitize HTML content to prevent XSS. Uses nh3 (Rust-based, fast)."""
    if not html:
        return ""
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
    )


def strip_to_text(raw: str) -> str:
    """
    Reduce HTML to plain text, preserving word boundaries.

    Tags are replaced with a SPACE rather than removed. Deleting them outright —
    which is what nh3.clean(tags=set()) does — welds the last word of one block
    to the first word of the next: "…Russia says</h1><p>Published August 4"
    becomes "saysPublished August 4".

    That corrupted more than display text. Excerpts are what get embedded, so
    fused tokens degraded clustering similarity and topic classification as well.
    """
    if not raw:
        return ""
    # Replace tags with whitespace before any entity decoding, so a literal
    # "&lt;b&gt;" in the source is never treated as markup.
    text = re.sub(r"<[^>]*>", " ", raw)
    text = html.unescape(text)
    # Drop anything that decoding revealed as markup, and normalise whitespace.
    text = re.sub(r"<[^>]*>", " ", text)
    return " ".join(text.split()).strip()


def clean_title(raw: str) -> str:
    """
    Reduce a feed title to plain text.

    Feeds are inconsistent: some ship HTML in <title>, some ship escaped
    entities, some ship both. Titles are rendered as text and embedded for
    clustering, so markup in them is corrupting on both counts.
    """
    return strip_to_text(raw)


def generate_content_hash(text: str) -> str:
    """Generate a SHA-256 hash of normalized text for deduplication."""
    normalized = " ".join(text.lower().split())
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


# Page furniture that publishers embed in article bodies. It carries no
# information, but it does get embedded into the vector used for clustering and
# topic classification, and it surfaces verbatim in excerpts — which is how a
# story summary ended up reading "…Russia says Published August 4, 2026 last
# updated August 4, 2026 What you need to know".
_BOILERPLATE_PATTERNS = [
    re.compile(r"\b(published|last updated|updated|first published)\b[:\s]*"
               r"[A-Z][a-z]+ \d{1,2},? \d{4}[^.]*", re.I),
    re.compile(r"\bwhat you need to know\b[:\s]*", re.I),
    # Consent/embed interstitials that trafilatura pulls in with the body.
    re.compile(r"\bto display this content[^.]*", re.I),
    re.compile(r"\b(share this article|sign up|subscribe to|read more|advertisement)\b[^.]*", re.I),
    re.compile(r"\bby\s+[A-Z][a-z]+ [A-Z][a-z]+,?\s+(BBC|CNN|Reuters|AP)\b[^.]*", re.I),
]


# Furniture phrases that show up welded to the preceding word in text stored
# before the extraction fix ("…claims more than 100 livesPublished August 5").
# Splitting on a lowercase→phrase boundary lets the patterns above match text
# that is already fused and can no longer be separated by tag position.
_FUSED_FURNITURE = re.compile(
    r"(?<=[a-z0-9])(?=(?:Published|Last updated|Updated|First published|"
    r"What you need to know|To display this content|Share this|Advertisement|"
    r"Sign up|Subscribe|Read more)\b)"
)


def strip_boilerplate(text: str) -> str:
    """Remove publisher page furniture from extracted text."""
    if not text:
        return ""
    text = _FUSED_FURNITURE.sub(" ", text)
    for pattern in _BOILERPLATE_PATTERNS:
        text = pattern.sub(" ", text)
    return " ".join(text.split()).strip()


def generate_excerpt(full_text: str, max_words: int = EXCERPT_WORD_LIMIT) -> str:
    """Generate a ~40 word excerpt from full text."""
    if not full_text:
        return ""
    clean_text = strip_boilerplate(strip_to_text(full_text))
    if not clean_text:
        return ""
    words = clean_text.split()
    if len(words) <= max_words:
        return clean_text
    return " ".join(words[:max_words]) + "…"


class FeedFetchError(Exception):
    """
    The feed could not be retrieved or parsed.

    Raised rather than returning an empty list so callers can tell "this source
    is broken" apart from "this source published nothing new". Conflating those
    two is how four dead feeds — including both Tier-1 wire services — sat at
    `consecutive_failures = 0` and rendered green on the health dashboard.
    """


class FeedNotModified(Exception):
    """The publisher answered 304; the feed is unchanged since our last fetch."""


class FeedResult:
    """Articles plus the cache validators to replay on the next request."""

    def __init__(self, articles: List[Dict[str, Any]], etag: str = "", last_modified: str = "",
                 entries_seen: int = 0):
        self.articles = articles
        self.etag = etag
        self.last_modified = last_modified
        self.entries_seen = entries_seen


class BaseScraper(ABC):
    @abstractmethod
    def fetch_articles(self, url: str, skip_urls: Optional[set] = None) -> List[Dict[str, Any]]:
        pass


class RSSScraper(BaseScraper):
    """
    Two-phase RSS scraper.

    Phase 1 parses the feed — cheap, one request. Phase 2 deep-fetches article
    pages for full text and og:image, but *only* for URLs the caller says are new.

    The previous implementation deep-fetched every entry on every run with a 15s
    timeout each, before deduplication happened downstream. A 50-item feed could
    therefore need 750s under a 30s task limit, and every unchanged article was
    re-downloaded every 30 minutes — wasted bandwidth and a fast route to being
    rate-limited or IP-banned by publishers.
    """

    def fetch_articles(
        self,
        url: str,
        skip_urls: Optional[set] = None,
        etag: str = "",
        last_modified: str = "",
    ) -> FeedResult:
        skip_urls = skip_urls or set()

        entries, new_etag, new_last_modified = self._parse_feed(url, etag, last_modified)

        pending = [e for e in entries if e['url'] and e['url'] not in skip_urls]
        skipped = len(entries) - len(pending)

        if len(pending) > MAX_DEEP_FETCH_PER_RUN:
            # Newest first — a backlog should surface current news, not history.
            pending.sort(key=lambda e: e['published_date'], reverse=True)
            logger.info(
                "Feed %s has %d new items; deep-fetching the newest %d this run.",
                url, len(pending), MAX_DEEP_FETCH_PER_RUN,
            )
            pending = pending[:MAX_DEEP_FETCH_PER_RUN]

        if pending:
            self._enrich_all(pending)

        logger.info(
            "Feed %s: %d entries, %d already stored, %d prepared.",
            url, len(entries), skipped, len(pending),
        )
        return FeedResult(
            articles=[self._finalize(entry) for entry in pending],
            etag=new_etag,
            last_modified=new_last_modified,
            entries_seen=len(entries),
        )

    # -- phase 1 -----------------------------------------------------------

    def _parse_feed(self, url: str, etag: str = "", last_modified: str = ""):
        """
        Fetch and parse the feed.

        Downloads with httpx rather than letting feedparser fetch the URL itself,
        because feedparser's internal fetch has no timeout and will hang a worker
        indefinitely on an unresponsive host.

        Raises FeedFetchError on any transport or parse failure — the caller needs
        to record that as a failure, not silently treat it as "no new articles".
        """
        headers = {"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml, */*"}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        # Retry transient transport failures before blaming the source.
        #
        # Fanning 41 feed fetches out at once overwhelms the container's DNS
        # resolver, producing "No address associated with hostname" for feeds
        # that are perfectly healthy — Al Jazeera, DW, NYT and The Guardian all
        # got marked failing this way. A resolver blip on our side must not
        # count against a publisher, or the health dashboard measures our
        # infrastructure instead of theirs.
        last_exception: Exception | None = None
        for attempt in range(FEED_FETCH_ATTEMPTS):
            try:
                response = httpx.get(
                    url,
                    headers=headers,
                    timeout=FEED_TIMEOUT_SECONDS,
                    follow_redirects=True,
                )
                break
            except TRANSIENT_ERRORS as e:
                last_exception = e
                if attempt < FEED_FETCH_ATTEMPTS - 1:
                    # Jittered backoff so retries from parallel workers don't
                    # re-converge and reproduce the same stampede.
                    sleep(FEED_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.4))  # noqa: S311 - scheduling jitter, not a secret
                    continue
            except httpx.HTTPError as e:
                # Non-transient (malformed URL, too many redirects, TLS refusal).
                raise FeedFetchError(f"{type(e).__name__}: {str(e)[:120]}") from e
        else:
            raise FeedFetchError(
                f"{type(last_exception).__name__} after {FEED_FETCH_ATTEMPTS} attempts: "
                f"{str(last_exception)[:100]}"
            ) from last_exception

        if response.status_code == 304:
            raise FeedNotModified()

        if response.status_code >= 400:
            raise FeedFetchError(f"HTTP {response.status_code}")

        feed = feedparser.parse(response.content)

        # bozo means the parser hit malformed XML. With entries present it's
        # usually a recoverable quirk; with none it's a real failure — commonly
        # an HTML error page or interstitial served with a 200.
        if not feed.entries:
            reason = getattr(feed, 'bozo_exception', None)
            raise FeedFetchError(
                f"No entries parsed ({type(reason).__name__ if reason else 'empty feed'})"
            )

        return (
            [self._parse_entry(entry) for entry in feed.entries],
            response.headers.get("ETag", "")[:300],
            response.headers.get("Last-Modified", "")[:120],
        )

    def _parse_entry(self, entry) -> Dict[str, Any]:
        # Handle date parsing — always produce timezone-aware datetimes
        published_date = None
        for attr in ('published_parsed', 'updated_parsed'):
            parsed = getattr(entry, attr, None)
            if parsed:
                published_date = datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
                break
        if published_date is None:
            published_date = datetime.now(tz=timezone.utc)

        summary = entry.get('summary', '') or entry.get('description', '')

        return {
            # Some feeds put markup in <title> — one Sky News item arrived as a
            # literal `<a href="...">`. Titles are rendered as text everywhere,
            # so strip tags and unescape entities at the boundary rather than
            # leaving every consumer to cope.
            'title': clean_title(entry.get('title', '')) or 'Untitled',
            'url': entry.get('link', ''),
            'summary': summary,
            'content': summary,
            'published_date': published_date,
            'image_url': self._entry_image(entry),
            'deep_fetch_success': False,
        }

    @staticmethod
    def _entry_image(entry) -> Optional[str]:
        if entry.get('media_content'):
            return entry.media_content[0].get('url')
        if entry.get('media_thumbnail'):
            return entry.media_thumbnail[0].get('url')
        for link in entry.get('links', []):
            if getattr(link, 'rel', '') == 'enclosure' and getattr(link, 'type', '').startswith('image/'):
                return link.href
        return None

    # -- phase 2 -----------------------------------------------------------

    def _enrich_all(self, entries: List[Dict[str, Any]]) -> None:
        """Deep-fetch article pages in parallel; mutates entries in place."""
        with httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=ARTICLE_TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as client, ThreadPoolExecutor(max_workers=DEEP_FETCH_CONCURRENCY) as pool:
            list(pool.map(lambda e: self._enrich(client, e), entries))

    def _enrich(self, client: httpx.Client, entry: Dict[str, Any]) -> None:
        try:
            response = client.get(entry['url'])
            response.raise_for_status()
            if len(response.content) > MAX_ARTICLE_BYTES:
                logger.debug("Skipping oversized page %s", entry['url'][:80])
                return
            downloaded = response.text
        except httpx.HTTPError as e:
            logger.debug("Deep-fetch failed for %s: %s", entry['url'][:80], type(e).__name__)
            return

        if not downloaded:
            return

        try:
            import trafilatura

            full_text = trafilatura.extract(
                downloaded, include_comments=False, include_tables=False
            )
            if full_text and len(full_text) > len(entry['summary']):
                entry['content'] = "".join(
                    f"<p>{nh3.clean(line, tags=set())}</p>"
                    for line in full_text.split('\n')
                    if line.strip()
                )
                entry['deep_fetch_success'] = True
        except Exception as e:
            logger.debug("Text extraction failed for %s: %s", entry['url'][:80], type(e).__name__)

        image = self._extract_og_image(downloaded, entry['url'])
        if image:
            entry['image_url'] = image

    @staticmethod
    def _extract_og_image(html: str, base_url: str) -> Optional[str]:
        try:
            from lxml import html as lxml_html

            tree = lxml_html.fromstring(html)
        except Exception:
            return None

        for xpath in (
            '//meta[@property="og:image"]/@content',
            '//meta[@name="twitter:image"]/@content',
        ):
            found = tree.xpath(xpath)
            if found and found[0]:
                candidate = found[0].strip()
                if not candidate.startswith(('http://', 'https://')):
                    candidate = urljoin(base_url, candidate)
                return candidate
        return None

    # -- output ------------------------------------------------------------

    @staticmethod
    def _finalize(entry: Dict[str, Any]) -> Dict[str, Any]:
        content = entry['content']
        return {
            'title': entry['title'],
            'url': entry['url'],
            'content': sanitize_html(content),
            'excerpt': generate_excerpt(content),
            'content_hash': generate_content_hash(f"{entry['title']} {content}"),
            'published_date': entry['published_date'],
            'image_url': entry['image_url'],
            'deep_fetch_success': entry['deep_fetch_success'],
        }


class ScraperService:
    def __init__(self):
        self.scrapers = {
            'rss': RSSScraper()
        }

    def scrape_source(self, source, skip_urls: Optional[Iterable[str]] = None) -> FeedResult:
        """
        Scrape one source, skipping URLs the caller already has stored.

        Passing `skip_urls` keeps deep-fetching proportional to *new* articles
        rather than to feed size. Raises FeedFetchError / FeedNotModified so the
        caller can record health accurately.
        """
        scraper = self.scrapers.get(source.scraper_type)
        if not scraper:
            raise FeedFetchError(f"No scraper registered for type '{source.scraper_type}'")

        return scraper.fetch_articles(
            source.url,
            skip_urls=set(skip_urls or ()),
            etag=source.etag,
            last_modified=source.last_modified,
        )
