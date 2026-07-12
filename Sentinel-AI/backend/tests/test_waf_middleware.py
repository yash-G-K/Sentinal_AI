import pytest
from app.models.request import Request, DecisionType
from app.models.attack_log import AttackLog

def test_middleware_allows_legitimate_request(client, db_session):
    response = client.get("/public/health")
    # Our app might return 404 because /public/health doesn't exist, but WAF shouldn't return 403
    assert response.status_code != 403

    req = db_session.query(Request).order_by(Request.id.desc()).first()
    assert req is not None
    assert req.endpoint == "/public/health"
    assert req.decision == DecisionType.ALLOW

def test_middleware_blocks_sqli_request(client, db_session):
    # Send a malicious request
    response = client.get("/public/health?test=UNION+ALL+SELECT")
    
    # WAF should intercept and return 403
    assert response.status_code == 403
    assert "Forbidden by WAF Policy" in response.json()["detail"]

    # Verify Database Updates
    req = db_session.query(Request).order_by(Request.id.desc()).first()
    assert req is not None
    assert req.decision == DecisionType.BLOCK

    attack = db_session.query(AttackLog).filter(AttackLog.request_id == req.id).first()
    assert attack is not None
    assert attack.attack_type.value == "SQLI"
    assert attack.blocked is True

def test_middleware_blocks_bot_request(client, db_session):
    response = client.get("/public/health", headers={"User-Agent": "python-requests/2.25"})
    
    assert response.status_code == 403
    
    attack = db_session.query(AttackLog).order_by(AttackLog.id.desc()).first()
    assert attack is not None
    assert attack.attack_type.value == "BOT"
