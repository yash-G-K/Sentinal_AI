"""
app/api/endpoints/audit.py
GET /api/v1/audit  — paginated, filterable audit log endpoint
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, Any, List
from pydantic import BaseModel
from datetime import datetime

from app.database.database import get_db
from app.services.audit_service import audit_service

router = APIRouter()


# ── Pydantic response schema matching AuditLogs.tsx LogEntry interface ──────

class ActorSchema(BaseModel):
    type: str
    name: str
    ip: Optional[str] = None


class DiffSchema(BaseModel):
    before: dict
    after: dict


class AuditLogSchema(BaseModel):
    id: str
    timestamp: str
    severity: str
    category: str
    action: str
    actor: ActorSchema
    resource: str
    message: str
    requestId: str
    country: Optional[str] = None
    userAgent: Optional[str] = None
    meta: dict
    diff: Optional[DiffSchema] = None


class AuditPageResponse(BaseModel):
    success: bool = True
    data: List[AuditLogSchema]
    total: int
    page: int
    size: int
    pages: int


def _to_schema(log) -> AuditLogSchema:
    """Map ORM AuditLog → AuditLogSchema matching the frontend LogEntry contract."""
    diff = None
    if log.diff_before is not None or log.diff_after is not None:
        diff = DiffSchema(
            before=log.diff_before or {},
            after=log.diff_after or {}
        )

    return AuditLogSchema(
        id=f"L{log.id:04d}",
        timestamp=log.timestamp.isoformat() + "Z" if log.timestamp else "",
        severity=log.severity.value if hasattr(log.severity, "value") else str(log.severity),
        category=log.category.value if hasattr(log.category, "value") else str(log.category),
        action=log.action.value if hasattr(log.action, "value") else str(log.action),
        actor=ActorSchema(
            type=log.actor_type.value if hasattr(log.actor_type, "value") else str(log.actor_type),
            name=log.actor_name,
            ip=log.actor_ip or "—",
        ),
        resource=log.resource,
        message=log.message,
        requestId=log.request_id or "—",
        country=log.country or "—",
        userAgent=log.user_agent or "—",
        meta=log.meta_data or {},
        diff=diff,
    )


@router.get("", response_model=AuditPageResponse)
def get_audit_logs(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    severity:   Optional[str] = Query(None),
    category:   Optional[str] = Query(None),
    action:     Optional[str] = Query(None),
    actor_type: Optional[str] = Query(None, alias="actorType"),
    search:     Optional[str] = Query(None),
    date_from:  Optional[str] = Query(None, alias="dateFrom"),
    date_to:    Optional[str] = Query(None, alias="dateTo"),
):
    items, total = audit_service.get_audit_logs(
        db,
        page=page, size=size,
        severity=severity, category=category,
        action=action, actor_type=actor_type,
        search=search, date_from=date_from, date_to=date_to,
    )
    pages = max(1, (total + size - 1) // size)
    return AuditPageResponse(
        data=[_to_schema(log) for log in items],
        total=total,
        page=page,
        size=size,
        pages=pages,
    )
