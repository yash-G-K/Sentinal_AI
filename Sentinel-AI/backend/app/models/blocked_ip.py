from typing import Optional
from datetime import datetime
import enum
from sqlalchemy import String, BigInteger, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class BlockStatus(str, enum.Enum):
    BLOCKED = "BLOCKED"
    UNBLOCKED = "UNBLOCKED"

class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    rule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("firewall_rules.id", ondelete="SET NULL"))
    blocked_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column()
    updated_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    status: Mapped[BlockStatus] = mapped_column(Enum(BlockStatus), default=BlockStatus.BLOCKED, nullable=False)

    # Relationships
    rule: Mapped[Optional["FirewallRule"]] = relationship("FirewallRule", back_populates="blocked_ips")
