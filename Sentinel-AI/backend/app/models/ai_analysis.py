from typing import Optional
from datetime import datetime
from sqlalchemy import String, BigInteger, Text, ForeignKey, Integer, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .attack_log import AttackType, SeverityLevel

class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), unique=True, nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    raw_response: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    attack_type: Mapped[Optional[AttackType]] = mapped_column(Enum(AttackType))
    severity: Mapped[Optional[SeverityLevel]] = mapped_column(Enum(SeverityLevel))
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    recommendation: Mapped[Optional[str]] = mapped_column(Text)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer)
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow)

    # Relationships
    request: Mapped["Request"] = relationship("Request", back_populates="ai_analysis")
