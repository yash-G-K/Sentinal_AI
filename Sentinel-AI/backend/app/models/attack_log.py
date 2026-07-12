from typing import Optional
from datetime import datetime
import enum
from sqlalchemy import String, BigInteger, Text, Boolean, ForeignKey, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .request import DecisionType

class AttackType(str, enum.Enum):
    SQLI = "SQLI"
    XSS = "XSS"
    COMMAND_INJECTION = "COMMAND_INJECTION"
    PATH_TRAVERSAL = "PATH_TRAVERSAL"
    BOT = "BOT"
    UNKNOWN = "UNKNOWN"

class SeverityLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AttackLog(Base):
    __tablename__ = "attack_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), nullable=False)
    attack_type: Mapped[AttackType] = mapped_column(Enum(AttackType), nullable=False, index=True)
    severity: Mapped[SeverityLevel] = mapped_column(Enum(SeverityLevel), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    detector: Mapped[Optional[str]] = mapped_column(String(100))
    matched_pattern: Mapped[Optional[str]] = mapped_column(Text)
    payload_snippet: Mapped[Optional[str]] = mapped_column(Text)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    action: Mapped[Optional[DecisionType]] = mapped_column(Enum(DecisionType))
    detected_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, index=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    request: Mapped["Request"] = relationship("Request", back_populates="attack_logs")
