"""
app/api/endpoints/users.py
GET  /api/v1/users              — list all users
POST /api/v1/users              — create a new user
PUT  /api/v1/users/{id}/status  — toggle active/suspended
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database.database import get_db
from app.services.auth_service import auth_service

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreateRequest(BaseModel):
    email: str
    full_name: str
    password: str
    role: str = "SOC Analyst"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    lastLogin: Optional[str] = None
    mfaEnabled: bool

    @classmethod
    def from_orm(cls, user) -> "UserResponse":
        last = None
        if user.last_login:
            # Format as relative time or ISO string
            diff = datetime.utcnow() - user.last_login
            mins = int(diff.total_seconds() / 60)
            if mins < 60:
                last = f"{mins} min ago" if mins > 1 else "Just now"
            elif mins < 1440:
                last = f"{mins // 60} hours ago"
            else:
                last = f"{mins // 1440} days ago"
        else:
            last = "Never"

        return cls(
            id=user.id,
            name=user.full_name or user.username,
            email=user.email,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            status=user.status.value if hasattr(user.status, "value") else str(user.status),
            lastLogin=last,
            mfaEnabled=user.mfa_enabled,
        )


class UsersListResponse(BaseModel):
    success: bool = True
    data: List[UserResponse]
    total: int


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=UsersListResponse)
def list_users(db: Session = Depends(get_db)):
    users = auth_service.get_all_users(db)
    return UsersListResponse(
        data=[UserResponse.from_orm(u) for u in users],
        total=len(users),
    )


@router.post("", response_model=UserResponse)
def create_user(body: UserCreateRequest, db: Session = Depends(get_db)):
    user = auth_service.create_user(
        db,
        email=body.email,
        full_name=body.full_name,
        password=body.password,
        role=body.role,
    )
    return UserResponse.from_orm(user)


@router.put("/{user_id}/status", response_model=UserResponse)
def toggle_user_status(user_id: int, db: Session = Depends(get_db)):
    user = auth_service.toggle_status(db, user_id)
    return UserResponse.from_orm(user)
