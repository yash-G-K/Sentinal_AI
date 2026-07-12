from typing import Optional
from datetime import datetime
from sqlalchemy import String, BigInteger, Text, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .attack_log import SeverityLevel

class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[Optional[int]] = mapped_column(ForeignKey("requests.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[SeverityLevel] = mapped_column(Enum(SeverityLevel), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, index=True)

    # Relationships
    request: Mapped[Optional["Request"]] = relationship("Request", back_populates="security_events")
