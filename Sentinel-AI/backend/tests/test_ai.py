import pytest
import asyncio
import uuid
from unittest.mock import patch, AsyncMock
from app.ai.ollama_service import ollama_service
from app.models.ai_analysis import AIAnalysis
from app.models.request import Request as RequestModel, DecisionType, RequestMethod, RequestProtocol
from app.models.ip_reputation import IPReputation


@pytest.mark.asyncio
async def test_ai_analysis_storage(db_session):
    """
    Test that Ollama analysis results are correctly stored in ai_analysis.
    Creates a real request row in MySQL first so the FK constraint is satisfied.
    """
    # Step 1: Ensure the IP exists in ip_reputation (FK dependency of requests)
    ip = "10.99.99.99"
    ip_rep = db_session.query(IPReputation).filter_by(ip_address=ip).first()
    if not ip_rep:
        ip_rep = IPReputation(ip_address=ip, reputation_score=100.0)
        db_session.add(ip_rep)
        db_session.flush()

    # Step 2: Create a real request row so ai_analysis FK is satisfied
    req = RequestModel(
        request_uuid=str(uuid.uuid4()),
        ip_address=ip,
        method=RequestMethod.GET,
        protocol=RequestProtocol.HTTP_1_1,
        host="testserver",
        endpoint="/test",
        full_url="http://testserver/test",
        query_params={},
        headers={},
        cookies={},
        body="<script>alert(1)</script>",
        user_agent="testclient",
        content_type="",
        content_length=0,
        response_status=200,
        response_time_ms=10,
        decision=DecisionType.BLOCK,
        country="US",
        city="TestCity",
    )
    db_session.add(req)
    db_session.commit()
    db_session.refresh(req)
    real_request_id = req.id

    # Step 3: Mock Ollama HTTP call and run analysis against the real request ID
    mock_response = {
        "response": '{"attack_type": "SQLI", "severity": "HIGH", "confidence": 99.0, "explanation": "Test", "recommendation": "Block"}',
        "eval_count": 42
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = AsyncMock()
        mock_resp.raise_for_status = lambda: None
        mock_resp.json = lambda: mock_response
        mock_post.return_value = mock_resp

        # Patch SessionLocal as a factory so the service gets a fresh session
        with patch("app.ai.ollama_service.SessionLocal", side_effect=lambda: db_session):
            await ollama_service.analyze_threat(
                request_id=real_request_id,
                method="GET",
                url="http://testserver/test",
                headers={},
                body="<script>alert(1)</script>",
                detector_result={"attack_type": "XSS", "severity": "HIGH", "matched_pattern": ".*"}
            )

    # Step 4: Verify the AI analysis was stored in MySQL
    analysis = db_session.query(AIAnalysis).filter_by(request_id=real_request_id).first()
    assert analysis is not None, "AI analysis was not saved to the database"
    assert analysis.attack_type.value == "SQLI"
    assert analysis.tokens_used == 42
    assert analysis.confidence == 99.0
