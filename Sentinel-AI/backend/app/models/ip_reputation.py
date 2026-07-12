from typing import Optional, List
from datetime import datetime
import enum
from sqlalchemy import String, Integer, Float, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class ReputationStatus(str, enum.Enum):
    SAFE = "SAFE"
    SUSPICIOUS = "SUSPICIOUS"
    BLOCKED = "BLOCKED"

class IPReputation(Base):
    __tablename__ = "ip_reputation"

    ip_address: Mapped[str] = mapped_column(String(45), primary_key=True)
    reputation_score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False, index=True)
    total_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    malicious_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    blocked_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sqli_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    xss_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    command_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    traversal_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bot_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[ReputationStatus] = mapped_column(Enum(ReputationStatus), default=ReputationStatus.SAFE, nullable=False)
    blocked_until: Mapped[Optional[datetime]] = mapped_column()
    last_seen: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    requests: Mapped[List["Request"]] = relationship("Request", back_populates="ip_reputation", cascade="all, delete-orphan")
