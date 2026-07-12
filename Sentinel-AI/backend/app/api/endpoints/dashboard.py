"""
Dashboard API — Phase 1 + Phase 9 (Caching).

Endpoints:
  GET /api/v1/dashboard/kpis     → All 8 KPI cards with trend % (cached 30s)
  GET /api/v1/dashboard/charts   → All chart data  (cached 5min)
  GET /api/v1/dashboard/summary  → Legacy endpoint (kept for backward compat)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database.database import get_db
from app.models.request import Request
from app.models.attack_log import AttackLog
from app.models.blocked_ip import BlockedIP, BlockStatus
from app.models.security_event import SecurityEvent
from app.schemas.responses import (
    DashboardSummary,
    DashboardKpis, DashboardCharts,
    KpiValue, TrafficChart, AttackTimelineChart, RiskTrendChart, GeoData, GeoEntry, IPEntry,
)
from app.services import dashboard_service
from app.services.cache_service import cache, TTL

router = APIRouter()


# ── Phase 1 + Cache Endpoints ─────────────────────────────────────────────────

@router.get("/kpis", response_model=DashboardKpis)
async def get_dashboard_kpis(db: Session = Depends(get_db)):
    """
    Returns all 8 KPI values with trend percentages.
    Cached for 30 seconds — invalidated by new request processing.
    """
    cached = await cache.get("dashboard:kpis")
    if cached:
        return DashboardKpis(**{k: KpiValue(**v) for k, v in cached.items()})

    raw = dashboard_service.get_kpis(db)
    await cache.set("dashboard:kpis", raw, ttl=TTL["kpis"])

    return DashboardKpis(
        total_requests=   KpiValue(**raw["total_requests"]),
        blocked_requests= KpiValue(**raw["blocked_requests"]),
        allowed_requests= KpiValue(**raw["allowed_requests"]),
        threat_score=     KpiValue(**raw["threat_score"]),
        critical_alerts=  KpiValue(**raw["critical_alerts"]),
        avg_response_ms=  KpiValue(**raw["avg_response_ms"]),
        firewall_health=  KpiValue(**raw["firewall_health"]),
        ai_confidence=    KpiValue(**raw["ai_confidence"]),
    )


@router.get("/charts", response_model=DashboardCharts)
async def get_dashboard_charts(db: Session = Depends(get_db)):
    """
    Returns all chart data in a single request.
    Cached for 5 minutes — time-series data changes slowly.
    """
    cached = await cache.get("dashboard:charts")
    if cached:
        return DashboardCharts(
            traffic=TrafficChart(**cached["traffic"]),
            attack_timeline=AttackTimelineChart(**cached["attack_timeline"]),
            risk_trend=RiskTrendChart(**cached["risk_trend"]),
            geo=GeoData(
                top_countries=[GeoEntry(**c) for c in cached["geo"]["top_countries"]],
                top_ips=[IPEntry(**ip) for ip in cached["geo"]["top_ips"]],
            ),
        )

    traffic_raw   = dashboard_service.get_traffic_chart(db)
    timeline_raw  = dashboard_service.get_attack_timeline(db)
    risk_raw      = dashboard_service.get_risk_trend(db)
    geo_raw       = dashboard_service.get_geo_data(db)

    payload = {
        "traffic":        traffic_raw,
        "attack_timeline": timeline_raw,
        "risk_trend":     risk_raw,
        "geo":            geo_raw,
    }
    await cache.set("dashboard:charts", payload, ttl=TTL["charts"])

    return DashboardCharts(
        traffic=TrafficChart(**traffic_raw),
        attack_timeline=AttackTimelineChart(**timeline_raw),
        risk_trend=RiskTrendChart(**risk_raw),
        geo=GeoData(
            top_countries=[GeoEntry(**c) for c in geo_raw["top_countries"]],
            top_ips=[IPEntry(**ip) for ip in geo_raw["top_ips"]],
        ),
    )


# ── Legacy Endpoint ───────────────────────────────────────────────────────────

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Legacy summary endpoint. Kept for backward compatibility."""
    total_reqs   = db.query(func.count(Request.id)).scalar() or 0
    total_attacks = db.query(func.count(AttackLog.id)).scalar() or 0

    blocked_ips = db.query(func.count(BlockedIP.id)).filter(
        BlockedIP.status == BlockStatus.BLOCKED,
        (BlockedIP.expires_at > datetime.utcnow()) | (BlockedIP.expires_at == None)
    ).scalar() or 0

    recent_events = db.query(func.count(SecurityEvent.id)).filter(
        SecurityEvent.created_at >= datetime.utcnow() - timedelta(days=1)
    ).scalar() or 0

    attack_types_query = db.query(
        AttackLog.attack_type,
        func.count(AttackLog.id).label("count")
    ).group_by(AttackLog.attack_type).all()

    attacks_by_type = [
        {"type": row.attack_type.value if hasattr(row.attack_type, "value") else row.attack_type, "count": row.count}
        for row in attack_types_query
    ]

    return DashboardSummary(
        total_requests=total_reqs,
        total_attacks=total_attacks,
        total_blocked_ips=blocked_ips,
        recent_security_events=recent_events,
        attacks_by_type=attacks_by_type,
        requests_over_time=[],
    )
