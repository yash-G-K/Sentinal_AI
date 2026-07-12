"""
Test configuration for Sentinel-AI.

Uses the REAL MySQL database so all data is visible in MySQL Workbench.

What is mocked (external calls only):
- GeoIP lookup → returns ('US', 'TestCity') — avoids calling ip-api.com
- Ollama AI → disabled via AI_ENABLED=False — avoids calling the LLM

Test isolation strategy:
- The 'testclient' IP reputation is reset to SAFE before each test so that
  previous test runs don't leave the test client IP in a BLOCKED state.
- WAF middleware tests explicitly send known-bad payloads to test blocking.
- API tests use a clean reputation so requests are allowed through.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.database.database import get_db, SessionLocal, engine
from app.models.base import Base
from app.models.ip_reputation import IPReputation, ReputationStatus


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def ensure_tables():
    """Ensure all tables exist in MySQL (safe even if tables already exist)."""
    Base.metadata.create_all(bind=engine)
    yield
    # Do NOT drop tables — user wants to inspect data in MySQL Workbench.


@pytest.fixture
def db_session(ensure_tables):
    """Provides a real MySQL session per test."""
    from app.models.firewall_rule import FirewallRule
    from app.models.blocked_ip import BlockedIP, BlockStatus

    session = SessionLocal()

    test_ip = "testclient"

    # 1. Remove any firewall rules targeting the testclient IP
    session.query(FirewallRule).filter(
        FirewallRule.target == test_ip
    ).delete(synchronize_session=False)

    # 2. Remove any blocked_ips entries for testclient
    session.query(BlockedIP).filter(
        BlockedIP.ip_address == test_ip
    ).delete(synchronize_session=False)

    # 3. Reset testclient IP reputation to SAFE
    ip_rep = session.query(IPReputation).filter_by(ip_address=test_ip).first()
    if ip_rep:
        ip_rep.reputation_score = 100.0
        ip_rep.status = ReputationStatus.SAFE
        ip_rep.blocked_until = None

    session.commit()

    yield session
    session.close()


@pytest.fixture
def client(db_session):
    """
    TestClient connected to real MySQL.
    - get_db overridden to use the test session
    - SessionLocal in middleware patched to return the test session
    - GeoIP mocked — no external HTTP calls
    - AI disabled — no Ollama calls
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    async def mock_geoip_lookup(ip: str):
        return ("US", "TestCity")

    with patch("app.middleware.request_logger.SessionLocal", side_effect=lambda: db_session):
        with patch("app.services.threat_agent.SessionLocal", side_effect=lambda: db_session):
            with patch("app.middleware.request_logger.geoip_service.lookup", new=mock_geoip_lookup):
                with patch("app.ai.ollama_service.settings.AI_ENABLED", False):
                    with TestClient(app, headers={"User-Agent": "SentinelTestSuite/1.0"}) as c:
                        yield c

    app.dependency_overrides.clear()
