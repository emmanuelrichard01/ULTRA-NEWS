import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from core.models import Source, Article, RawDocument
from core.tasks import scrape_all_sources

@pytest.fixture
def test_source(db):
    return Source.objects.create(
        name="Test News",
        url="http://example.com/rss",
        scraper_type="rss",
        is_active=True
    )

@pytest.fixture
def mock_feedparser_data():
    mock_feed = MagicMock()
    
    entry1 = MagicMock()
    entry1.link = "http://example.com/article/1"
    entry1.title = "A Breaking Tech Story"
    entry1.summary = "This is a great new tech release from a major company."
    entry1.published_parsed = timezone.now().timetuple()
    
    entry2 = MagicMock()
    entry2.link = "http://example.com/article/2"
    entry2.title = "Another Science Update"
    entry2.summary = "Science is progressing fast."
    entry2.published_parsed = timezone.now().timetuple()
    
    mock_feed.entries = [entry1, entry2]
    return mock_feed

@pytest.mark.django_db
@patch('feedparser.parse')
@patch('trafilatura.fetch_url', return_value=None)
def test_rss_ingestion_creates_articles(mock_fetch, mock_parse, test_source, mock_feedparser_data):
    """Test that ingestion properly creates articles and RawDocuments."""
    mock_parse.return_value = mock_feedparser_data
    
    # Run the ingestion task
    result = scrape_all_sources()
    
    assert "Scraped 2 articles" in result
    assert Article.objects.count() == 2
    assert RawDocument.objects.count() == 2
    
    # Verify categories were assigned based on keywords
    tech_article = Article.objects.get(url="http://example.com/article/1")
    assert tech_article.categories.filter(slug="tech").exists()

@pytest.mark.django_db
@patch('feedparser.parse')
@patch('trafilatura.fetch_url', return_value=None)
def test_rss_ingestion_deduplication(mock_fetch, mock_parse, test_source, mock_feedparser_data):
    """Test that running ingestion twice doesn't create duplicate articles."""
    mock_parse.return_value = mock_feedparser_data
    
    # First run
    scrape_all_sources()
    assert Article.objects.count() == 2
    
    # Second run with same data
    result = scrape_all_sources()
    assert "Scraped 0 articles" in result
    assert Article.objects.count() == 2
