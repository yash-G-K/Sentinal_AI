from typing import Optional
from datetime import datetime
from sqlalchemy import String, BigInteger, Text, Boolean, Integer, Enum, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .request import DecisionType

class FirewallRule(Base):
    __tablename__ = "firewall_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    rule_type: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. CUSTOM, RATE_LIMIT, AUTO_TEMP
    target: Mapped[str] = mapped_column(String(255), nullable=False)   # Legacy, kept for backward compat
    
    # New JSON fields for complex rules
    conditions: Mapped[Optional[dict]] = mapped_column(JSON) # Array of Condition objects
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON)
    category: Mapped[Optional[str]] = mapped_column(String(50)) # e.g. "SQL Injection"
    
    action: Mapped[DecisionType] = mapped_column(Enum(DecisionType), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    
    # Lifecycle & Priority
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="Active", nullable=False) # Draft, Testing, Active, Disabled, Archived
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    
    # Tracking & Metrics
    hits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    versions_history: Mapped[Optional[list[dict]]] = mapped_column(JSON) # Audit history for rollbacks
    last_matched_at: Mapped[Optional[datetime]] = mapped_column()
    avg_execution_time_ms: Mapped[Optional[float]] = mapped_column(Float)

    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    expires_at: Mapped[Optional[datetime]] = mapped_column()
    created_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator: Mapped[Optional["User"]] = relationship("User", back_populates="firewall_rules")
    blocked_ips: Mapped[list["BlockedIP"]] = relationship("BlockedIP", back_populates="rule")
