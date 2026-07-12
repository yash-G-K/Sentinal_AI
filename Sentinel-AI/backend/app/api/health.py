from fastapi import APIRouter
from app.config.settings import settings

router = APIRouter()

@router.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint to verify backend status."""
    return {
        "status": "running",
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION
    }
