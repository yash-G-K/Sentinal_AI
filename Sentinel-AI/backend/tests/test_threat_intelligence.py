"""
Phase 3 Threat Intelligence API tests.
"""
import pytest


def test_threat_intelligence_summary_structure(client):
    """GET /threat-intelligence/summary must return all top-level sections."""
    response = client.get("/api/v1/threat-intelligence/summary")
    assert response.status_code == 200
    data = response.json()

    # All top-level keys must be present
    assert "summary" in data
    assert "attack_categories" in data
    assert "mitre_attacks" in data
    assert "emerging_threats" in data
    assert "iocs" in data
    assert "ai_insight" in data
    assert "recommendations" in data


def test_threat_intelligence_summary_fields(client):
    """Summary card must have all required numeric fields."""
    response = client.get("/api/v1/threat-intelligence/summary")
    assert response.status_code == 200
    summary = response.json()["summary"]

    assert "risk_score" in summary
    assert "risk_level" in summary
    assert "ai_confidence" in summary
    assert "detection_rate" in summary
    assert "false_positive_rate" in summary
    assert "attack_events" in summary

    # Risk score must be in valid range
    assert 0 <= summary["risk_score"] <= 100
    # Risk level must be valid
    assert summary["risk_level"] in ("low", "medium", "high", "critical")


def test_threat_intelligence_attack_categories_format(client):
    """Attack categories must have required fields."""
    response = client.get("/api/v1/threat-intelligence/summary")
    assert response.status_code == 200
    categories = response.json()["attack_categories"]

    # May be empty if no attack data, but if populated, check fields
    for cat in categories:
        assert "label" in cat
        assert "count" in cat
        assert "pct" in cat
        assert "color" in cat
        assert "trend" in cat
        assert 0 <= cat["pct"] <= 100


def test_threat_intelligence_ai_insight_format(client):
    """AI insight must have text, model, and confidence."""
    response = client.get("/api/v1/threat-intelligence/summary")
    assert response.status_code == 200
    insight = response.json()["ai_insight"]

    assert "text" in insight
    assert "model" in insight
    assert "confidence" in insight
    assert isinstance(insight["text"], str)
    assert len(insight["text"]) > 0
    assert 0 <= insight["confidence"] <= 100


def test_threat_intelligence_recommendations_format(client):
    """Recommendations must be well-formed."""
    response = client.get("/api/v1/threat-intelligence/summary")
    assert response.status_code == 200
    recs = response.json()["recommendations"]

    # Must always have at least the baseline done recs
    assert len(recs) >= 1
    for rec in recs:
        assert "id" in rec
        assert "action" in rec
        assert "effort" in rec
        assert "impact" in rec
        assert "done" in rec
        assert isinstance(rec["done"], bool)
