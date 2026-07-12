from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database.database import get_db
from app.models.security_event import SecurityEvent
from app.schemas.responses import PaginatedResponse, SecurityEventSchema
from app.api.utils import paginate

router = APIRouter()

@router.get("", response_model=PaginatedResponse[SecurityEventSchema])
def get_security_events(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    event_type: Optional[str] = None,
    severity: Optional[str] = None
):
    query = db.query(SecurityEvent).order_by(SecurityEvent.created_at.desc())
    
    if event_type:
        query = query.filter(SecurityEvent.event_type == event_type)
    if severity:
        query = query.filter(SecurityEvent.severity == severity)
        
    return paginate(db, query, page, size)
