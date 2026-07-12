import pytest
from app.models.request import DecisionType
from app.models.firewall_rule import FirewallRule
from app.models.ip_reputation import ReputationStatus
from app.detectors.base import DetectionResult
from app.models.attack_log import AttackType, SeverityLevel
from app.firewall.firewall_engine import firewall_engine

def test_firewall_blocks_blocked_reputation(db_session):
    decision = firewall_engine.evaluate(
        db_session, 
        "192.168.1.1", 
        request_id=1, 
        detector_result=None, 
        rep_status=ReputationStatus.BLOCKED,
        request_data={}
    )
    assert decision == DecisionType.BLOCK

def test_firewall_creates_temp_rule_on_threat(db_session):
    # Simulate a HIGH severity threat
    threat = DetectionResult(
        detected=True,
        attack_type=AttackType.SQLI,
        severity=SeverityLevel.HIGH,
        confidence=95.0
    )
    
    decision = firewall_engine.evaluate(
        db_session, 
        "172.16.0.1", 
        request_id=2, 
        detector_result=threat, 
        rep_status=ReputationStatus.SAFE,
        request_data={}
    )
    assert decision == DecisionType.BLOCK
    
    # Check if temporary firewall rule was created
    rule = db_session.query(FirewallRule).filter_by(target="172.16.0.1").first()
    assert rule is not None
    assert rule.rule_type == "AUTO_TEMP"
    assert rule.action == DecisionType.BLOCK

def test_firewall_quarantines_suspicious_ip_on_low_threat(db_session):
    threat = DetectionResult(
        detected=True,
        attack_type=AttackType.BOT,
        severity=SeverityLevel.LOW,
        confidence=60.0
    )
    
    decision = firewall_engine.evaluate(
        db_session, 
        "10.10.10.10", 
        request_id=3, 
        detector_result=threat, 
        rep_status=ReputationStatus.SUSPICIOUS,
        request_data={}
    )
    assert decision == DecisionType.QUARANTINE
