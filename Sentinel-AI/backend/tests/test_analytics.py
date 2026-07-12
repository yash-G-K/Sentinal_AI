"""
Phase 2 Analytics API tests.
"""
import pytest

def test_analytics_timeseries_shape(client):
    """GET /analytics/timeseries must return arrays of the correct length."""
    # Test 24h range (24 buckets)
    response = client.get("/api/v1/analytics/timeseries?range=24h")
    assert response.status_code == 200
    data = response.json()
    
    assert "labels" in data
    assert len(data["labels"]) == 24
    assert len(data["requests"]) == 24
    assert len(data["latencyP50"]) == 24
    assert len(data["sqli"]) == 24

    # Test 7d range (7 buckets)
    response_7d = client.get("/api/v1/analytics/timeseries?range=7d")
    assert response_7d.status_code == 200
    assert len(response_7d.json()["labels"]) == 7


def test_analytics_timeseries_invalid_range(client):
    """Invalid range should return 422."""
    response = client.get("/api/v1/analytics/timeseries?range=100d")
    assert response.status_code == 422


def test_analytics_top_stats_shape(client):
    """GET /analytics/top must return grouped stats."""
    response = client.get("/api/v1/analytics/top?range=30d")
    assert response.status_code == 200
    data = response.json()
    
    assert "top_endpoints" in data
    assert "top_countries" in data
    assert "http_methods" in data
    assert "status_codes" in data
    assert "asn_data" in data
    
    # Assert type checking (Pydantic models)
    if len(data["top_endpoints"]) > 0:
        assert "e" in data["top_endpoints"][0]
        assert "req" in data["top_endpoints"][0]
        
    if len(data["status_codes"]) > 0:
        assert "code" in data["status_codes"][0]
        assert "v" in data["status_codes"][0]
        assert "color" in data["status_codes"][0]
