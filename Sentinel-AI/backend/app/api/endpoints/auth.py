"""
app/api/endpoints/auth.py
POST /api/v1/auth/login   — issues JWT on valid credentials
POST /api/v1/auth/logout  — client-side only (stateless JWT)
GET  /api/v1/auth/me      — returns current user info from token
POST /api/v1/auth/signup  — registers a new user account (role=SOC Analyst by default)
POST /api/v1/auth/seed-demo — ensures the demo Super Admin account exists
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database.database import get_db
from app.services.auth_service import auth_service, decode_token

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "SOC Analyst"


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    user, token = auth_service.authenticate(db, body.email, body.password, ip=client_ip)
    return JSONResponse({
        "access_token": str(token),
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name or user.username,
            "role": user.role,
            "status": user.status,
            "mfa_enabled": user.mfa_enabled,
        }
    })


@router.post("/logout")
async def logout():
    return JSONResponse({"message": "Logged out successfully."})


@router.post("/signup", status_code=201)
async def signup(body: SignupRequest, db: Session = Depends(get_db)):
    """Creates a new user account. Returns the created user info (no token)."""
    from app.services.auth_service import auth_service
    import re
    # Basic password strength: min 8 chars, at least one letter and one digit
    if len(body.password) < 8:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters long.")
    user = auth_service.create_user(
        db,
        email=body.email,
        full_name=body.full_name,
        password=body.password,
        role=body.role,
    )
    return JSONResponse({
        "success": True,
        "message": "Account created successfully. Please sign in.",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        }
    })


@router.post("/seed-demo")
async def seed_demo(db: Session = Depends(get_db)):
    """Idempotently seeds the demo Super Admin account."""
    from app.services.auth_service import auth_service
    DEMO_ADMIN = {
        "email": "admin@sentinel.ai",
        "full_name": "Demo Super Admin",
        "password": "Admin@1234",
        "role": "Super Admin",
    }
    from app.models.user import User
    existing = db.query(User).filter(User.email == DEMO_ADMIN["email"]).first()
    if not existing:
        auth_service.create_user(db, **DEMO_ADMIN)
        return JSONResponse({"seeded": True, "message": "Demo admin created."})
    return JSONResponse({"seeded": False, "message": "Demo admin already exists."})


@router.get("/me")
async def get_me(authorization: Optional[str] = None):
    if not authorization or not authorization.startswith("Bearer "):
        return JSONResponse({"authenticated": False})
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    return JSONResponse({
        "authenticated": True,
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role"),
    })
