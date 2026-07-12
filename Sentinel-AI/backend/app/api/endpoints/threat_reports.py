from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database.database import get_db
from app.models.threat_report import ThreatReport
from app.schemas.responses import PaginatedResponse, ThreatReportSchema
from app.api.utils import paginate

router = APIRouter()

@router.get("", response_model=PaginatedResponse[ThreatReportSchema])
def get_threat_reports(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100)
):
    query = db.query(ThreatReport).order_by(ThreatReport.created_at.desc())
    return paginate(db, query, page, size)
