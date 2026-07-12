"""
app/api/endpoints/perf.py
Performance & operations endpoints:
  GET /api/v1/perf/cache         — cache status + hit stats
  POST /api/v1/perf/cache/flush  — flush specific key prefix or all
"""
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.services.cache_service import cache

router = APIRouter()


@router.get("/cache")
async def get_cache_status():
    """Returns current cache backend and stats."""
    return JSONResponse({"success": True, "cache": cache.status()})


@router.post("/cache/flush")
async def flush_cache(prefix: str = Query("", description="Key prefix to flush (empty = flush all)")):
    """Flush a specific cache prefix or all cache entries."""
    if prefix:
        count = await cache.delete_prefix(prefix)
        return JSONResponse({"success": True, "flushed_prefix": prefix, "keys_removed": count})
    else:
        # Flush all known prefixes
        removed = 0
        for p in ["dashboard:", "firewall:", "settings:", "analytics:", "ip:"]:
            removed += await cache.delete_prefix(p)
        return JSONResponse({"success": True, "message": "All cache cleared", "keys_removed": removed})
