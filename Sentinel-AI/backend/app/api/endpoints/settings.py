"""
app/api/endpoints/settings.py
GET  /api/v1/settings        — return all settings (cached indefinitely)
PUT  /api/v1/settings        — bulk-update + invalidate cache
POST /api/v1/settings/reset  — reset to defaults + invalidate cache
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict

from app.database.database import get_db
from app.services.settings_service import settings_service
from app.services.cache_service import cache, TTL

router = APIRouter()
CACHE_KEY = "settings:all"


class BulkUpdateRequest(BaseModel):
    settings: Dict[str, str]


@router.get("")
async def get_settings(db: Session = Depends(get_db)):
    cached = await cache.get(CACHE_KEY)
    if cached:
        return JSONResponse({"success": True, "data": cached, "cached": True})

    data = settings_service.get_all(db)
    await cache.set(CACHE_KEY, data, ttl=TTL["settings"])
    return JSONResponse({"success": True, "data": data, "cached": False})


@router.put("")
async def update_settings(body: BulkUpdateRequest, db: Session = Depends(get_db)):
    updated = settings_service.bulk_set(db, body.settings)
    await cache.delete(CACHE_KEY)     # Invalidate immediately
    return JSONResponse({"success": True, "data": updated, "message": "Settings saved successfully."})


@router.post("/reset")
async def reset_settings(db: Session = Depends(get_db)):
    defaults = settings_service.reset_to_defaults(db)
    await cache.delete(CACHE_KEY)
    return JSONResponse({"success": True, "data": defaults, "message": "Settings reset to defaults."})
