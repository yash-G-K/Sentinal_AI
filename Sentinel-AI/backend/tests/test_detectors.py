import pytest
from app.detectors import engine
from app.models.attack_log import AttackType, SeverityLevel

def test_legitimate_request():
    result = engine.analyze_request(
        method="GET",
        full_url="http://localhost:8000/api/v1/health",
        headers={"user-agent": "Mozilla/5.0"},
        query_params={"id": "123"},
        body=""
    )
    assert result is None

def test_sql_injection_detection():
    result = engine.analyze_request(
        method="POST",
        full_url="http://localhost/login",
        headers={"user-agent": "Mozilla/5.0"},
        query_params={},
        body='{"username": "admin\' OR 1=1 --", "password": "x"}'
    )
    assert result is not None
    assert result.detected is True
    assert result.attack_type == AttackType.SQLI
    assert result.severity == SeverityLevel.CRITICAL

def test_xss_detection():
    result = engine.analyze_request(
        method="GET",
        full_url="http://localhost/search?q=<script>alert('xss')</script>",
        headers={"user-agent": "Mozilla/5.0"},
        query_params={"q": "<script>alert('xss')</script>"},
        body=""
    )
    assert result is not None
    assert result.detected is True
    assert result.attack_type == AttackType.XSS

def test_command_injection_detection():
    result = engine.analyze_request(
        method="GET",
        full_url="http://localhost/ping?ip=127.0.0.1;cat /etc/passwd",
        headers={"user-agent": "Mozilla/5.0"},
        query_params={"ip": "127.0.0.1;cat /etc/passwd"},
        body=""
    )
    assert result is not None
    assert result.detected is True
    assert result.attack_type == AttackType.COMMAND_INJECTION

def test_directory_traversal_detection():
    result = engine.analyze_request(
        method="GET",
        full_url="http://localhost/download?file=../../../../etc/passwd",
        headers={"user-agent": "Mozilla/5.0"},
        query_params={"file": "../../../../etc/passwd"},
        body=""
    )
    assert result is not None
    assert result.detected is True
    assert result.attack_type == AttackType.PATH_TRAVERSAL

def test_bot_detection():
    result = engine.analyze_request(
        method="GET",
        full_url="http://localhost/",
        headers={"user-agent": "sqlmap/1.5"},
        query_params={},
        body=""
    )
    assert result is not None
    assert result.detected is True
    assert result.attack_type == AttackType.BOT
