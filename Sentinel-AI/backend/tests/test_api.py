import pytest

def test_dashboard_summary_api(client):
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_requests" in data
    assert "total_attacks" in data

def test_requests_api(client):
    response = client.get("/api/v1/requests")
    assert response.status_code == 200
    assert "items" in response.json()

def test_attacks_api(client):
    response = client.get("/api/v1/attacks?severity=CRITICAL")
    assert response.status_code == 200
    assert "items" in response.json()

def test_blocked_ips_api(client):
    response = client.get("/api/v1/firewall/blocked-ips")
    assert response.status_code == 200
    assert "items" in response.json()

def test_manual_block_api(client):
    response = client.post("/api/v1/firewall/block", json={
        "ip_address": "8.8.8.8",
        "reason": "Test Block"
    })
    assert response.status_code == 200
    
    # Verify IP is blocked
    response2 = client.get("/api/v1/ip/8.8.8.8")
    assert response2.status_code == 200
    assert response2.json()["status"] == "BLOCKED"
    assert response2.json()["reputation_score"] == 0.0

def test_manual_unblock_api(client):
    # First block the IP so there's something to unblock
    client.post("/api/v1/firewall/block", json={"ip_address": "8.8.8.8"})

    response = client.post("/api/v1/firewall/unblock", json={
        "ip_address": "8.8.8.8"
    })
    assert response.status_code == 200

    # Verify IP is SAFE
    response2 = client.get("/api/v1/ip/8.8.8.8")
    assert response2.status_code == 200
    assert response2.json()["status"] == "SAFE"
    assert response2.json()["reputation_score"] == 75.0
