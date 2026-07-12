"""
app/services/auth_service.py
Handles password hashing, JWT issuance/validation, and user lifecycle management.
"""
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from jose import JWTError, jwt
import bcrypt

from app.models.user import User
from app.models.login_history import LoginHistory, LoginStatus

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = "sentinel-ai-super-secret-jwt-key-change-in-production-2024"
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 8

VALID_ROLES = ["Super Admin", "Security Admin", "SOC Analyst", "Viewer", "API Developer"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Auth Service ──────────────────────────────────────────────────────────────

class AuthService:

    def authenticate(self, db: Session, email: str, password: str, ip: str = "unknown") -> tuple:
        """Validates credentials. Returns (user, token) or raises 401."""
        user = db.query(User).filter(User.email == email).first()

        if not user or not verify_password(password, user.password_hash):
            if user:
                self._log_login(db, user.id, ip, LoginStatus.FAILED)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if user.status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account suspended. Contact your administrator.",
            )

        user.last_login = datetime.utcnow()
        db.commit()
        self._log_login(db, user.id, ip, LoginStatus.SUCCESS)

        token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        })
        return user, token

    def get_all_users(self, db: Session):
        return db.query(User).order_by(User.created_at.desc()).all()

    def create_user(self, db: Session, *, email: str, full_name: str,
                    password: str, role: str = "SOC Analyst") -> User:
        if db.query(User).filter(User.email == email).first():
            raise HTTPException(status_code=400, detail=f"Email '{email}' already registered.")
        if role not in VALID_ROLES:
            role = "SOC Analyst"

        username = email.split("@")[0]
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
            role=role,
            status="active",
            mfa_enabled=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def toggle_status(self, db: Session, user_id: int) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        user.status = "suspended" if user.status == "active" else "active"
        db.commit()
        db.refresh(user)
        return user

    def _log_login(self, db: Session, user_id: int, ip: str, login_status: LoginStatus):
        db.add(LoginHistory(user_id=user_id, ip=ip, status=login_status))
        db.commit()


auth_service = AuthService()
