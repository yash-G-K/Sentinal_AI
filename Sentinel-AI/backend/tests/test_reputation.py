import pytest
from app.reputation.reputation_service import reputation_service
from app.models.ip_reputation import IPReputation, ReputationStatus
from app.models.attack_log import AttackType, SeverityLevel
from app.models.blocked_ip import BlockedIP, BlockStatus

def test_reputation_healing(db_session):
    # Test safe request
    status = reputation_service.evaluate_request(db_session, "192.168.1.1")
    assert status == ReputationStatus.SAFE
    
    ip_rep = db_session.query(IPReputation).filter_by(ip_address="192.168.1.1").first()
    assert ip_rep.reputation_score == 100.0 # Should not exceed MAX_SCORE
    assert ip_rep.total_requests == 1

def test_reputation_penalty(db_session):
    # Test malicious request
    status = reputation_service.evaluate_request(
        db_session, 
        "10.0.0.1", 
        attack_type=AttackType.SQLI, 
        severity=SeverityLevel.CRITICAL
    )
    
    ip_rep = db_session.query(IPReputation).filter_by(ip_address="10.0.0.1").first()
    assert ip_rep.reputation_score == 60.0 # 100 - 40 penalty
    assert ip_rep.status == ReputationStatus.SUSPICIOUS
    assert status == ReputationStatus.SUSPICIOUS

def test_automatic_blocking(db_session):
    # Hit an IP multiple times until it drops below BLOCK threshold
    for _ in range(3):
        status = reputation_service.evaluate_request(
            db_session, 
            "10.0.0.2", 
            attack_type=AttackType.COMMAND_INJECTION, 
            severity=SeverityLevel.CRITICAL
        )
        
    ip_rep = db_session.query(IPReputation).filter_by(ip_address="10.0.0.2").first()
    assert ip_rep.reputation_score == 0.0 # Bounded at 0
    assert ip_rep.status == ReputationStatus.BLOCKED
    
    # Check if blocked_ips entry was created
    blocked = db_session.query(BlockedIP).filter_by(ip_address="10.0.0.2").first()
    assert blocked is not None
    assert blocked.status == BlockStatus.BLOCKED
