from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, BigInteger, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class User(Base):
    """
    User model — role and status stored as plain VARCHAR to avoid MySQL Enum
    schema conflicts when values change. Application-level validation enforces valid values.
    """
    __tablename__ = "users"

    id:            Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username:      Mapped[str]           = mapped_column(String(255), unique=True, nullable=False, index=True)
    email:         Mapped[str]           = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name:     Mapped[Optional[str]] = mapped_column(String(255))
    password_hash: Mapped[str]           = mapped_column(String(255), nullable=False)
    role:          Mapped[str]           = mapped_column(String(50), default="SOC Analyst", nullable=False)
    status:        Mapped[str]           = mapped_column(String(20), default="active", nullable=False, index=True)
    mfa_enabled:   Mapped[bool]          = mapped_column(Boolean, default=False, nullable=False)
    last_login:    Mapped[Optional[datetime]] = mapped_column(default=None)
    created_at:    Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow)
    updated_at:    Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Valid role values (for reference/validation)
    VALID_ROLES = ["Super Admin", "Security Admin", "SOC Analyst", "Viewer", "API Developer"]

    # Relationships
    login_history:  Mapped[List["LoginHistory"]]  = relationship("LoginHistory", back_populates="user", cascade="all, delete-orphan")
    firewall_rules: Mapped[List["FirewallRule"]]  = relationship("FirewallRule", back_populates="creator")
