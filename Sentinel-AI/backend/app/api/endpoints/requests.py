from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database.database import get_db
from app.models.request import Request
from app.schemas.responses import PaginatedResponse, RequestSchema
from app.api.utils import paginate

router = APIRouter()

@router.get("", response_model=PaginatedResponse[RequestSchema])
def get_requests(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    ip_address: Optional[str] = None,
    method: Optional[str] = None,
    decision: Optional[str] = None,
    search: Optional[str] = None
):
    query = db.query(Request).order_by(Request.created_at.desc())
    
    if ip_address:
        query = query.filter(Request.ip_address == ip_address)
    if method:
        query = query.filter(Request.method == method)
    if decision:
        # Frontend sends lowercase ('blocked'/'allowed'); DB stores uppercase ('BLOCK'/'ALLOW')
        query = query.filter(Request.decision == decision.upper())
    if search:
        query = query.filter(
            (Request.endpoint.ilike(f"%{search}%")) |
            (Request.host.ilike(f"%{search}%"))
        )
        
    result = paginate(db, query, page, size)
    return result

@router.get("/{request_id}", response_model=RequestSchema)
def get_request_by_id(request_id: int, db: Session = Depends(get_db)):
    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req
