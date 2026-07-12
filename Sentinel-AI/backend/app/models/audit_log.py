"""
app/models/audit_log.py
Dedicated audit trail model — captures every significant administrative
and system-level action with full context, actor info, and JSON diffs.
"""
from typing import Optional
from datetime import datetime
from sqlalchemy import String, BigInteger, Text, Boolean, Enum, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
import enum


class AuditSeverity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH     = "high"
    MEDIUM   = "medium"
    LOW      = "low"
    INFO     = "info"


class AuditCategory(str, enum.Enum):
    AUTHENTICATION = "authentication"
    FIREWALL       = "firewall"
    POLICY         = "policy"
    SYSTEM         = "system"
    API            = "api"
    USER_MGMT      = "user-mgmt"


class AuditAction(str, enum.Enum):
    BLOCKED   = "blocked"
    ALLOWED   = "allowed"
    MODIFIED  = "modified"
    DELETED   = "deleted"
    CREATED   = "created"
    FAILED    = "failed"
    ESCALATED = "escalated"


class AuditActorType(str, enum.Enum):
    USER    = "user"
    SYSTEM  = "system"
    API_KEY = "api-key"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Timestamps
    timestamp: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)

    # Classification
    severity:  Mapped[AuditSeverity]  = mapped_column(Enum(AuditSeverity), nullable=False, index=True)
    category:  Mapped[AuditCategory]  = mapped_column(Enum(AuditCategory), nullable=False, index=True)
    action:    Mapped[AuditAction]    = mapped_column(Enum(AuditAction),   nullable=False, index=True)

    # Actor (who performed the action)
    actor_type: Mapped[AuditActorType] = mapped_column(Enum(AuditActorType), nullable=False, index=True)
    actor_name: Mapped[str]            = mapped_column(String(255), nullable=False)
    actor_ip:   Mapped[Optional[str]]  = mapped_column(String(45))

    # What was affected
    resource:  Mapped[str]            = mapped_column(Text, nullable=False)
    message:   Mapped[str]            = mapped_column(Text, nullable=False)

    # Request tracing
    request_id:  Mapped[Optional[str]] = mapped_column(String(100))  # UUID string
    country:     Mapped[Optional[str]] = mapped_column(String(10))
    user_agent:  Mapped[Optional[str]] = mapped_column(Text)

    # Rich metadata
    meta_data:    Mapped[Optional[dict]] = mapped_column(JSON)  # Extra context
    diff_before:  Mapped[Optional[dict]] = mapped_column(JSON)  # State before change
    diff_after:   Mapped[Optional[dict]] = mapped_column(JSON)  # State after change

    __table_args__ = (
        Index("ix_audit_logs_timestamp_severity", "timestamp", "severity"),
        Index("ix_audit_logs_category_action", "category", "action"),
    )
