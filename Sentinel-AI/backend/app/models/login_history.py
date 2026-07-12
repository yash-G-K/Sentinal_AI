from typing import Optional
from datetime import datetime
from sqlalchemy import String, BigInteger, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
import enum

class LoginStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class LoginHistory(Base):
    __tablename__ = "login_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip: Mapped[str] = mapped_column(String(45), nullable=False)
    login_time: Mapped[Optional[datetime]] = mapped_column(default=datetime.utcnow)
    status: Mapped[LoginStatus] = mapped_column(Enum(LoginStatus), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="login_history")
