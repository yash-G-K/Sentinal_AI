from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database.database import get_db
from app.models.attack_log import AttackLog
from app.schemas.responses import PaginatedResponse, AttackLogSchema
from app.api.utils import paginate

router = APIRouter()

@router.get("", response_model=PaginatedResponse[AttackLogSchema])
def get_attacks(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    attack_type: Optional[str] = None,
    severity: Optional[str] = None,
    blocked: Optional[bool] = None
):
    query = db.query(AttackLog).order_by(AttackLog.detected_at.desc())
    
    if attack_type:
        query = query.filter(AttackLog.attack_type == attack_type)
    if severity:
        query = query.filter(AttackLog.severity == severity)
    if blocked is not None:
        query = query.filter(AttackLog.blocked == blocked)
        
    result = paginate(db, query, page, size)
    return result
