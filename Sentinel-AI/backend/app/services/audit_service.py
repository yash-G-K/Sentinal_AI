"""
app/services/audit_service.py
Manages audit log creation and retrieval with full filtering support.
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.audit_log import (
    AuditLog, AuditSeverity, AuditCategory, AuditAction, AuditActorType
)


class AuditService:
    def log_action(
        self,
        db: Session,
        *,
        severity: AuditSeverity,
        category: AuditCategory,
        action: AuditAction,
        actor_type: AuditActorType,
        actor_name: str,
        actor_ip: Optional[str] = None,
        resource: str,
        message: str,
        request_id: Optional[str] = None,
        country: Optional[str] = None,
        user_agent: Optional[str] = None,
        meta_data: Optional[dict] = None,
        diff_before: Optional[dict] = None,
        diff_after: Optional[dict] = None,
        commit: bool = True,
    ) -> AuditLog:
        """Create and persist a single audit log entry."""
        entry = AuditLog(
            severity=severity,
            category=category,
            action=action,
            actor_type=actor_type,
            actor_name=actor_name,
            actor_ip=actor_ip,
            resource=resource,
            message=message,
            request_id=request_id,
            country=country,
            user_agent=user_agent,
            meta_data=meta_data or {},
            diff_before=diff_before,
            diff_after=diff_after,
        )
        db.add(entry)
        if commit:
            db.commit()
            db.refresh(entry)
        return entry

    def get_audit_logs(
        self,
        db: Session,
        *,
        page: int = 1,
        size: int = 20,
        severity: Optional[str] = None,
        category: Optional[str] = None,
        action: Optional[str] = None,
        actor_type: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> tuple[List[AuditLog], int]:
        """Retrieve paginated, filtered audit logs. Returns (items, total_count)."""
        q = db.query(AuditLog)

        if severity:
            q = q.filter(AuditLog.severity == severity)
        if category:
            q = q.filter(AuditLog.category == category)
        if action:
            q = q.filter(AuditLog.action == action)
        if actor_type:
            q = q.filter(AuditLog.actor_type == actor_type)
        if search:
            term = f"%{search.lower()}%"
            q = q.filter(
                AuditLog.message.ilike(term) |
                AuditLog.resource.ilike(term) |
                AuditLog.actor_name.ilike(term) |
                AuditLog.request_id.ilike(term)
            )
        if date_from:
            try:
                dt = datetime.fromisoformat(date_from)
                q = q.filter(AuditLog.timestamp >= dt)
            except ValueError:
                pass
        if date_to:
            try:
                dt = datetime.fromisoformat(date_to + "T23:59:59")
                q = q.filter(AuditLog.timestamp <= dt)
            except ValueError:
                pass

        total = q.count()
        items = q.order_by(desc(AuditLog.timestamp)).offset((page - 1) * size).limit(size).all()
        return items, total


audit_service = AuditService()
