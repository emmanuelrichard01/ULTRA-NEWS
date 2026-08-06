from unittest.mock import patch

import pytest
from django.core.cache import cache
from ninja.testing import TestClient

from api.api import MAX_ASK_DAILY_REQUESTS, api


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()

@pytest.mark.django_db
def test_ask_endpoint_query_validation():
    client = TestClient(api)
    
    # Test query exceeding MAX_ASK_QUERY_LENGTH (500 chars)
    long_query = "A" * 501
    response = client.post("/ask", json={"query": long_query})
    assert response.status_code == 422 # Pydantic schema validation failure

@pytest.mark.django_db
def test_ask_endpoint_circuit_breaker():
    client = TestClient(api)
    
    # Simulate daily limit reached by populating cache
    from datetime import datetime
    daily_key = f"ask:daily_requests:{datetime.now().strftime('%Y-%m-%d')}"
    cache.set(daily_key, MAX_ASK_DAILY_REQUESTS, timeout=86400)
    
    response = client.post("/ask", json={"query": "Valid test query"})
    assert response.status_code == 503
    assert "quota reached" in response.json().get("detail", "").lower()

@pytest.mark.django_db
def test_ask_endpoint_rate_limiter():
    client = TestClient(api)
    
    # Mock fastembed model to prevent real ML load during testing
    with patch("core.clustering.get_embedding_model") as mock_get_model:
        mock_model = mock_get_model.return_value
        mock_model.embed.return_value = [[0.1] * 384]
        
        # /ask has rate limit of 10 requests per minute
        for _ in range(10):
            response = client.post("/ask", json={"query": "What is happening with rates?"})
            assert response.status_code in [200, 400]
            
        # 11th request must be throttled
        response = client.post("/ask", json={"query": "What is happening with rates?"})
        assert response.status_code == 429
        assert response.json() == {"detail": "Too Many Requests"}
