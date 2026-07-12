from typing import Optional
from datetime import datetime
import enum
from sqlalchemy import String, BigInteger, Text, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from .attack_log import AttackType

class ReportGenerator(str, enum.Enum):
    SYSTEM = "SYSTEM"
    AI = "AI"

class ThreatReport(Base):
    __tablename__ = "threat_reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    total_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    blocked_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    top_attack: Mapped[Optional[AttackType]] = mapped_column(Enum(AttackType))
    top_ip: Mapped[Optional[str]] = mapped_column(String(45))
    generated_by: Mapped[Optional[ReportGenerator]] = mapped_column(Enum(ReportGenerator))
    recommendation: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
