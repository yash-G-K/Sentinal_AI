"""
Threat Intelligence API — Phase 3.

Endpoint:
  GET /api/v1/threat-intelligence/summary  -> Full TI page data in one call
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.responses import ThreatIntelligenceResponse
from app.services import threat_intelligence_service as ti_svc

router = APIRouter()


@router.get("/summary", response_model=ThreatIntelligenceResponse)
def get_threat_intelligence(db: Session = Depends(get_db)):
    """
    Returns the complete Threat Intelligence page dataset in a single call.
    The frontend ThreatIntelligence.tsx uses this to populate all sections:
    risk summary, attack categories, MITRE mapping, emerging threats, IOCs, AI insight, recommendations.
    """
    return ThreatIntelligenceResponse(
        summary            = ti_svc.get_threat_summary(db),
        attack_categories  = ti_svc.get_attack_categories(db),
        mitre_attacks      = ti_svc.get_mitre_attacks(db),
        emerging_threats   = ti_svc.get_emerging_threats(db),
        iocs               = ti_svc.get_iocs(db),
        ai_insight         = ti_svc.get_ai_insight(db),
        recommendations    = ti_svc.get_recommendations(db),
    )
