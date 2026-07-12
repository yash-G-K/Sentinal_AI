from typing import Optional, List
from datetime import datetime
import enum
from sqlalchemy import String, BigInteger, Text, JSON, Integer, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class RequestMethod(str, enum.Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    OPTIONS = "OPTIONS"
    HEAD = "HEAD"

class RequestProtocol(str, enum.Enum):
    HTTP_1_0 = "HTTP/1.0"
    HTTP_1_1 = "HTTP/1.1"
    HTTP_2 = "HTTP/2"
    HTTP_3 = "HTTP/3"

class DecisionType(str, enum.Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    QUARANTINE = "QUARANTINE"

class Request(Base):
    __tablename__ = "requests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(ForeignKey("ip_reputation.ip_address", ondelete="CASCADE"), nullable=False, index=True)
    method: Mapped[RequestMethod] = mapped_column(Enum(RequestMethod), nullable=False, index=True)
    protocol: Mapped[Optional[RequestProtocol]] = mapped_column(Enum(RequestProtocol))
    host: Mapped[Optional[str]] = mapped_column(String(255))
    endpoint: Mapped[Optional[str]] = mapped_column(String(2048))
    full_url: Mapped[Optional[str]] = mapped_column(Text)
    query_params: Mapped[Optional[dict]] = mapped_column(JSON)
    headers: Mapped[Optional[dict]] = mapped_column(JSON)
    cookies: Mapped[Optional[dict]] = mapped_column(JSON)
    body: Mapped[Optional[str]] = mapped_column(Text)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    content_type: Mapped[Optional[str]] = mapped_column(String(255))
    content_length: Mapped[Optional[int]] = mapped_column(Integer)
    response_status: Mapped[Optional[int]] = mapped_column(Integer)
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    decision: Mapped[DecisionType] = mapped_column(Enum(DecisionType), nullable=False, index=True)
    country: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, index=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ip_reputation: Mapped["IPReputation"] = relationship("IPReputation", back_populates="requests")
    attack_logs: Mapped[List["AttackLog"]] = relationship("AttackLog", back_populates="request", cascade="all, delete-orphan")
    ai_analysis: Mapped[Optional["AIAnalysis"]] = relationship("AIAnalysis", back_populates="request", uselist=False, cascade="all, delete-orphan")
    security_events: Mapped[List["SecurityEvent"]] = relationship("SecurityEvent", back_populates="request")
