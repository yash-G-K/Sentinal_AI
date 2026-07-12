"""
app/models/protected_domain.py
ProtectedDomain - represents an application/site protected by Sentinel-AI WAF.
"""
from typing import Optional, List
from datetime import datetime
import enum
from sqlalchemy import String, BigInteger, Text, Boolean, Integer, JSON, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class DomainStatus(str, enum.Enum):
    HEALTHY      = "healthy"
    WARNING      = "warning"
    OFFLINE      = "offline"
    UNREACHABLE  = "unreachable"
    UNDER_ATTACK = "under_attack"
    UNKNOWN      = "unknown"

class DomainRisk(str, enum.Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"
    NONE     = "none"

class ProtectionMode(str, enum.Enum):
    BLOCK     = "block"
    LOG_ONLY  = "log_only"
    DISABLED  = "disabled"

class AppType(str, enum.Enum):
    DVWA        = "DVWA"
    JUICE_SHOP  = "JuiceShop"
    WORDPRESS   = "WordPress"
    DJANGO      = "Django"
    FLASK       = "Flask"
    NODEJS      = "NodeJS"
    LARAVEL     = "Laravel"
    CUSTOM      = "Custom"

class EnvironmentType(str, enum.Enum):
    DOCKER      = "Docker"
    VM          = "VM"
    BARE_METAL  = "Bare Metal"
    CLOUD       = "Cloud"
    KUBERNETES  = "Kubernetes"

class CriticalityLevel(str, enum.Enum):
    CRITICAL = "Critical"
    HIGH     = "High"
    MEDIUM   = "Medium"
    LOW      = "Low"


# ── Model ─────────────────────────────────────────────────────────────────────

class ProtectedDomain(Base):
    """
    Represents an application/domain protected by the WAF.
    Stats are computed by matching request.host against this domain's host field.
    """
    __tablename__ = "protected_domains"

    # Identity
    id:           Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name:         Mapped[str]           = mapped_column(String(255), nullable=False, index=True)
    host:         Mapped[str]           = mapped_column(String(255), nullable=False, index=True, unique=True)
    origin_url:   Mapped[str]           = mapped_column(Text, nullable=False)
    description:  Mapped[Optional[str]] = mapped_column(Text)

    # Classification
    app_type:     Mapped[str]           = mapped_column(String(50), default="Custom", nullable=False)
    environment:  Mapped[str]           = mapped_column(String(50), default="Docker", nullable=False)
    icon:         Mapped[Optional[str]] = mapped_column(String(10))   # emoji icon e.g. "🛡️"
    color:        Mapped[Optional[str]] = mapped_column(String(20))   # hex color for card accent

    # Status & Risk
    status:       Mapped[str]           = mapped_column(String(30), default="unknown", nullable=False, index=True)
    risk:         Mapped[str]           = mapped_column(String(20), default="none", nullable=False, index=True)
    enabled:      Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Protection
    protection_mode: Mapped[str]        = mapped_column(String(20), default="block", nullable=False)

    # Organization metadata
    owner:         Mapped[Optional[str]] = mapped_column(String(255))
    team:          Mapped[Optional[str]] = mapped_column(String(255))
    business_unit: Mapped[Optional[str]] = mapped_column(String(255))
    criticality:   Mapped[str]           = mapped_column(String(20), default="Medium", nullable=False)
    internet_facing: Mapped[bool]        = mapped_column(Boolean, default=True, nullable=False)
    production:    Mapped[bool]          = mapped_column(Boolean, default=False, nullable=False)

    # Health check data
    health_status:       Mapped[Optional[int]]   = mapped_column(Integer)   # HTTP status from last health check
    health_latency_ms:   Mapped[Optional[float]] = mapped_column(Float)     # Response time in ms
    last_seen:           Mapped[Optional[datetime]] = mapped_column()        # Last successful health check
    last_request_at:     Mapped[Optional[datetime]] = mapped_column()        # Last WAF request seen
    last_attack_at:      Mapped[Optional[datetime]] = mapped_column()        # Last detected attack
    last_block_at:       Mapped[Optional[datetime]] = mapped_column()        # Last blocked request

    # SSL / TLS (reserved for future use)
    ssl_enabled:    Mapped[bool]            = mapped_column(Boolean, default=False, nullable=False)
    ssl_expiry:     Mapped[Optional[datetime]] = mapped_column()
    tls_version:    Mapped[Optional[str]]   = mapped_column(String(20))
    https_redirect: Mapped[bool]            = mapped_column(Boolean, default=False, nullable=False)

    # Reverse proxy settings (reserved)
    proxy_enabled:  Mapped[bool]            = mapped_column(Boolean, default=False, nullable=False)
    proxy_port:     Mapped[Optional[int]]   = mapped_column(Integer)
    listen_port:    Mapped[Optional[int]]   = mapped_column(Integer)
    upstream_port:  Mapped[Optional[int]]   = mapped_column(Integer)

    # Freeform metadata
    tags:           Mapped[Optional[list]]  = mapped_column(JSON)

    # Audit
    created_by:  Mapped[Optional[int]]      = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at:  Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow)
    updated_at:  Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at:  Mapped[Optional[datetime]] = mapped_column(default=None)
    deleted_by:  Mapped[Optional[int]]      = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    # Relationships
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
