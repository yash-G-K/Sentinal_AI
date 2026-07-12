"""
Analytics API — Phase 2 + Phase 9 (Caching).

Endpoints:
  GET /api/v1/analytics/timeseries?range={r} → Timeseries charts (cached 5 min per range)
  GET /api/v1/analytics/top?range={r}        → Top-N grouped stats (cached 5 min per range)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.responses import AnalyticsTimeseries, AnalyticsTopStats
from app.services import analytics_service
from app.services.cache_service import cache, TTL

router = APIRouter()

VALID_RANGES = {"24h", "7d", "30d", "90d"}


@router.get("/timeseries", response_model=AnalyticsTimeseries)
async def get_analytics_timeseries(
    range: str = Query("30d", pattern="^(24h|7d|30d|90d)$", description="Time range for analytics"),
    db: Session = Depends(get_db)
):
    """
    Returns time-bucketed analytics data for the requested range.
    Cached per range key for 5 minutes.
    """
    cache_key = f"analytics:timeseries:{range}"
    cached = await cache.get(cache_key)
    if cached:
        return AnalyticsTimeseries(**cached)

    data = analytics_service.get_timeseries(db, range)
    await cache.set(cache_key, data, ttl=TTL["analytics"])
    return AnalyticsTimeseries(**data)


@router.get("/top", response_model=AnalyticsTopStats)
async def get_analytics_top_stats(
    range: str = Query("30d", pattern="^(24h|7d|30d|90d)$", description="Time range for analytics"),
    db: Session = Depends(get_db)
):
    """
    Returns grouped Top-N statistics for endpoints, countries, methods, etc.
    Cached per range key for 5 minutes.
    """
    cache_key = f"analytics:top:{range}"
    cached = await cache.get(cache_key)
    if cached:
        return AnalyticsTopStats(**cached)

    data = analytics_service.get_top_stats(db, range)
    await cache.set(cache_key, data, ttl=TTL["analytics"])
    return AnalyticsTopStats(**data)
