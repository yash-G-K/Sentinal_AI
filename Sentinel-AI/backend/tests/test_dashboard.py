"""
Phase 1 Dashboard API tests.
Tests both new endpoints: /kpis and /charts.
"""
import pytest


def test_dashboard_kpis_shape(client):
    """GET /dashboard/kpis must return all 8 KPI fields with value and trend."""
    response = client.get("/api/v1/dashboard/kpis")
    assert response.status_code == 200
    data = response.json()

    expected_keys = [
        "total_requests", "blocked_requests", "allowed_requests",
        "threat_score", "critical_alerts", "avg_response_ms",
        "firewall_health", "ai_confidence",
    ]
    for key in expected_keys:
        assert key in data, f"Missing KPI: {key}"
        assert "value" in data[key], f"Missing 'value' in {key}"
        assert "trend" in data[key], f"Missing 'trend' in {key}"
        assert isinstance(data[key]["value"], (int, float)), f"'value' must be numeric in {key}"
        assert isinstance(data[key]["trend"], (int, float)), f"'trend' must be numeric in {key}"


def test_dashboard_kpis_values_non_negative(client):
    """KPI numeric values must be >= 0."""
    response = client.get("/api/v1/dashboard/kpis")
    assert response.status_code == 200
    data = response.json()
    for key, kpi in data.items():
        assert kpi["value"] >= 0, f"{key}.value is negative: {kpi['value']}"


def test_dashboard_charts_shape(client):
    """GET /dashboard/charts must return all chart sections with correct list lengths."""
    response = client.get("/api/v1/dashboard/charts")
    assert response.status_code == 200
    data = response.json()

    # Traffic chart — 24 hourly buckets
    assert "traffic" in data
    assert len(data["traffic"]["labels"])  == 24
    assert len(data["traffic"]["allowed"]) == 24
    assert len(data["traffic"]["blocked"]) == 24

    # Attack timeline — 24 hourly buckets, 4 severity series
    assert "attack_timeline" in data
    timeline = data["attack_timeline"]
    assert len(timeline["labels"])   == 24
    assert len(timeline["critical"]) == 24
    assert len(timeline["high"])     == 24
    assert len(timeline["medium"])   == 24
    assert len(timeline["low"])      == 24

    # Risk trend — 30 daily buckets
    assert "risk_trend" in data
    assert len(data["risk_trend"]["labels"]) == 30
    assert len(data["risk_trend"]["scores"]) == 30

    # Geo data
    assert "geo" in data
    assert "top_countries" in data["geo"]
    assert "top_ips"       in data["geo"]


def test_dashboard_charts_risk_scores_bounded(client):
    """Risk scores must be between 0 and 100."""
    response = client.get("/api/v1/dashboard/charts")
    assert response.status_code == 200
    scores = response.json()["risk_trend"]["scores"]
    for score in scores:
        assert 0.0 <= score <= 100.0, f"Risk score out of bounds: {score}"


def test_dashboard_charts_traffic_non_negative(client):
    """Traffic series values must all be >= 0."""
    response = client.get("/api/v1/dashboard/charts")
    assert response.status_code == 200
    traffic = response.json()["traffic"]
    for v in traffic["allowed"] + traffic["blocked"]:
        assert v >= 0
