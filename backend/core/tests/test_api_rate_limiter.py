import pytest
from django.core.cache import cache
from ninja.testing import TestClient

from api.api import api


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()

@pytest.mark.django_db
def test_rate_limiter():
    client = TestClient(api)
    
    # Send 60 requests (the limit for /stories is 60/min)
    for _ in range(60):
        response = client.get("/stories")
        assert response.status_code == 200
        
    # 61st request should be blocked
    response = client.get("/stories")
    assert response.status_code == 429
    assert response.json() == {"detail": "Too Many Requests"}
