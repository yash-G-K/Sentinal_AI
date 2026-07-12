"""
Dashboard Service — Phase 1.

All aggregation queries for the Dashboard page live here.
Each method returns plain Python dicts/lists so the endpoint
can serialize them directly via Pydantic.

Queries are scoped to last 24h for real-time KPIs, and last 30 days
for the Risk Trend chart, matching exactly what the frontend charts expect.
"""
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, case, text
from sqlalchemy.orm import Session

from app.models.request import Request, DecisionType
from app.models.attack_log import AttackLog, SeverityLevel, AttackType
from app.models.ai_analysis import AIAnalysis
from app.models.security_event import SecurityEvent
from app.models.ip_reputation import IPReputation


# ─── Time buckets ─────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.utcnow()

def _24h_ago() -> datetime:
    return _now() - timedelta(hours=24)

def _prev_24h_start() -> datetime:
    return _now() - timedelta(hours=48)

def _prev_24h_end() -> datetime:
    return _now() - timedelta(hours=24)

def _30d_ago() -> datetime:
    return _now() - timedelta(days=30)


# ─── KPI Service ──────────────────────────────────────────────────────────────

def get_kpis(db: Session) -> dict[str, Any]:
    """
    Returns all 8 KPI values for the Dashboard KPI row.

    KPIs:
    1. Total Requests (24h)
    2. Blocked Requests (24h)
    3. Allowed Requests (24h)
    4. Threat Score (avg AI confidence on blocked requests, last 24h, 0-100)
    5. Critical Alerts (CRITICAL severity attacks, last 24h)
    6. Avg Response Time ms (last 24h)
    7. Firewall Health % (uptime proxy: % of requests processed without error)
    8. AI Confidence % (avg confidence on AI-analyzed attacks, last 24h)

    Each KPI also includes a `trend` (% change vs previous 24h window).
    """
    since  = _24h_ago()
    prev_s = _prev_24h_start()
    prev_e = _prev_24h_end()

    # ── Current 24h window ────────────────────────────────────────────────────
    total = db.query(func.count(Request.id)).filter(
        Request.created_at >= since
    ).scalar() or 0

    blocked = db.query(func.count(Request.id)).filter(
        Request.created_at >= since,
        Request.decision == DecisionType.BLOCK
    ).scalar() or 0

    allowed = total - blocked

    critical_alerts = db.query(func.count(AttackLog.id)).join(
        Request, AttackLog.request_id == Request.id
    ).filter(
        Request.created_at >= since,
        AttackLog.severity == SeverityLevel.CRITICAL
    ).scalar() or 0

    avg_response_ms = db.query(func.avg(Request.response_time_ms)).filter(
        Request.created_at >= since,
        Request.response_time_ms > 0
    ).scalar()
    avg_response_ms = round(float(avg_response_ms), 1) if avg_response_ms else 0.0

    avg_ai_confidence = db.query(func.avg(AIAnalysis.confidence)).join(
        Request, AIAnalysis.request_id == Request.id
    ).filter(
        Request.created_at >= since
    ).scalar()
    avg_ai_confidence = round(float(avg_ai_confidence), 1) if avg_ai_confidence else 0.0

    # Threat score: avg confidence of blocked-request AI analyses (0→100)
    threat_score = db.query(func.avg(AIAnalysis.confidence)).join(
        Request, AIAnalysis.request_id == Request.id
    ).filter(
        Request.created_at >= since,
        Request.decision == DecisionType.BLOCK
    ).scalar()
    threat_score = round(float(threat_score), 1) if threat_score else 0.0

    # Firewall health: (successful requests / total) * 100
    # A request is "successful" if response_status is not 5xx
    error_count = db.query(func.count(Request.id)).filter(
        Request.created_at >= since,
        Request.response_status >= 500
    ).scalar() or 0
    firewall_health = round(100.0 * (1 - error_count / max(total, 1)), 2)

    # ── Previous 24h window (for trend %) ─────────────────────────────────────
    prev_total = db.query(func.count(Request.id)).filter(
        Request.created_at >= prev_s,
        Request.created_at < prev_e
    ).scalar() or 0

    prev_blocked = db.query(func.count(Request.id)).filter(
        Request.created_at >= prev_s,
        Request.created_at < prev_e,
        Request.decision == DecisionType.BLOCK
    ).scalar() or 0

    prev_allowed   = prev_total - prev_blocked
    prev_critical  = db.query(func.count(AttackLog.id)).join(
        Request, AttackLog.request_id == Request.id
    ).filter(
        Request.created_at >= prev_s,
        Request.created_at < prev_e,
        AttackLog.severity == SeverityLevel.CRITICAL
    ).scalar() or 0

    prev_response_ms = db.query(func.avg(Request.response_time_ms)).filter(
        Request.created_at >= prev_s,
        Request.created_at < prev_e,
        Request.response_time_ms > 0
    ).scalar()
    prev_response_ms = float(prev_response_ms) if prev_response_ms else 0.0

    prev_ai_conf = db.query(func.avg(AIAnalysis.confidence)).join(
        Request, AIAnalysis.request_id == Request.id
    ).filter(
        Request.created_at >= prev_s,
        Request.created_at < prev_e
    ).scalar()
    prev_ai_conf = float(prev_ai_conf) if prev_ai_conf else 0.0

    def pct_change(current: float, previous: float) -> float:
        if previous == 0:
            return 0.0
        return round(((current - previous) / previous) * 100, 1)

    return {
        "total_requests":    {"value": total,            "trend": pct_change(total, prev_total)},
        "blocked_requests":  {"value": blocked,          "trend": pct_change(blocked, prev_blocked)},
        "allowed_requests":  {"value": allowed,          "trend": pct_change(allowed, prev_allowed)},
        "threat_score":      {"value": threat_score,     "trend": pct_change(threat_score, 50.0)},
        "critical_alerts":   {"value": critical_alerts,  "trend": pct_change(critical_alerts, prev_critical)},
        "avg_response_ms":   {"value": avg_response_ms,  "trend": pct_change(avg_response_ms, prev_response_ms)},
        "firewall_health":   {"value": firewall_health,  "trend": 0.0},
        "ai_confidence":     {"value": avg_ai_confidence,"trend": pct_change(avg_ai_confidence, prev_ai_conf)},
    }


# ─── Traffic Chart (hourly buckets, last 24h) ─────────────────────────────────

def get_traffic_chart(db: Session) -> dict[str, Any]:
    """
    Returns hourly allowed/blocked counts for the last 24 hours.
    Produces 24 data points matching the hoursLabels(24) x-axis in options.ts.
    """
    since = _24h_ago()

    # MySQL DATE_FORMAT to get 'HH:00' bucket
    rows = db.execute(text("""
        SELECT
            DATE_FORMAT(created_at, '%H:00') AS hour_label,
            HOUR(created_at) AS hour_num,
            SUM(CASE WHEN decision = 'ALLOW' THEN 1 ELSE 0 END) AS allowed,
            SUM(CASE WHEN decision = 'BLOCK'  THEN 1 ELSE 0 END) AS blocked
        FROM requests
        WHERE created_at >= :since
        GROUP BY hour_num, hour_label
        ORDER BY hour_num
    """), {"since": since}).fetchall()

    # Build a full 24-slot array (0..23), fill with 0 for missing hours
    allowed_by_hour = {r.hour_num: int(r.allowed) for r in rows}
    blocked_by_hour = {r.hour_num: int(r.blocked) for r in rows}

    now_hour = datetime.utcnow().hour
    hours    = [(now_hour - 23 + i) % 24 for i in range(24)]  # ordered from oldest to newest

    allowed_series = [allowed_by_hour.get(h, 0) for h in hours]
    blocked_series = [blocked_by_hour.get(h, 0) for h in hours]
    labels         = [f"{h:02d}:00" for h in hours]

    return {
        "labels":  labels,
        "allowed": allowed_series,
        "blocked": blocked_series,
    }


# ─── Attack Timeline Chart (by severity, hourly, last 24h) ───────────────────

def get_attack_timeline(db: Session) -> dict[str, Any]:
    """
    Returns hourly attack counts split by severity for the last 24 hours.
    Matches the attackTimelineOption stacked bar chart.
    """
    since = _24h_ago()

    rows = db.execute(text("""
        SELECT
            HOUR(r.created_at) AS hour_num,
            al.severity,
            COUNT(*) AS cnt
        FROM attack_logs al
        JOIN requests r ON al.request_id = r.id
        WHERE r.created_at >= :since
        GROUP BY hour_num, al.severity
        ORDER BY hour_num
    """), {"since": since}).fetchall()

    now_hour = datetime.utcnow().hour
    hours    = [(now_hour - 23 + i) % 24 for i in range(24)]
    labels   = [f"{h:02d}:00" for h in hours]

    # Initialize per-severity buckets
    sev_data: dict[str, dict[int, int]] = {
        "CRITICAL": {}, "HIGH": {}, "MEDIUM": {}, "LOW": {}
    }
    for row in rows:
        sev = row.severity.upper() if hasattr(row.severity, "upper") else str(row.severity).upper()
        if sev in sev_data:
            sev_data[sev][row.hour_num] = int(row.cnt)

    return {
        "labels":   labels,
        "critical": [sev_data["CRITICAL"].get(h, 0) for h in hours],
        "high":     [sev_data["HIGH"].get(h, 0)     for h in hours],
        "medium":   [sev_data["MEDIUM"].get(h, 0)   for h in hours],
        "low":      [sev_data["LOW"].get(h, 0)       for h in hours],
    }


# ─── Risk Trend Chart (daily risk score, last 30 days) ───────────────────────

def get_risk_trend(db: Session) -> dict[str, Any]:
    """
    Returns a 30-day daily risk score (0-100).
    Risk score = (blocked / total) * 100 normalized with attack severity weighting.
    Matches the riskTrendOption line chart.
    """
    since = _30d_ago()

    rows = db.execute(text("""
        SELECT
            DATE(r.created_at) AS day,
            COUNT(r.id) AS total,
            SUM(CASE WHEN r.decision = 'BLOCK' THEN 1 ELSE 0 END) AS blocked,
            SUM(CASE WHEN al.severity = 'CRITICAL' THEN 4
                     WHEN al.severity = 'HIGH'     THEN 3
                     WHEN al.severity = 'MEDIUM'   THEN 2
                     WHEN al.severity = 'LOW'      THEN 1
                     ELSE 0 END) AS severity_weight,
            COUNT(al.id) AS attack_count
        FROM requests r
        LEFT JOIN attack_logs al ON al.request_id = r.id
        WHERE r.created_at >= :since
        GROUP BY day
        ORDER BY day
    """), {"since": since}).fetchall()

    # Build a 30-slot array, one per day
    from datetime import date
    today  = date.today()
    days   = [(today - timedelta(days=29 - i)) for i in range(30)]
    labels = [d.strftime("%b %d") for d in days]

    risk_by_day: dict[str, float] = {}
    for row in rows:
        if row.total and row.total > 0:
            block_ratio   = float(row.blocked or 0) / float(row.total)
            severity_bonus = min(float(row.severity_weight or 0) / max(float(row.attack_count or 1), 1) * 10, 30)
            score = round(min(100.0, block_ratio * 70 + severity_bonus), 1)
        else:
            score = 0.0
        risk_by_day[str(row.day)] = score

    scores = [risk_by_day.get(str(d), 0.0) for d in days]

    return {"labels": labels, "scores": scores}


# ─── Geo Map Data ─────────────────────────────────────────────────────────────

def get_geo_data(db: Session) -> dict[str, Any]:
    """
    Returns top attack-origin countries with counts for the AttackMap sidebar.
    Also returns top attacking IPs.
    """
    since = _24h_ago()

    country_rows = db.execute(text("""
        SELECT country, COUNT(*) AS cnt
        FROM requests
        WHERE created_at >= :since
          AND decision = 'BLOCK'
          AND country IS NOT NULL
          AND country != ''
        GROUP BY country
        ORDER BY cnt DESC
        LIMIT 10
    """), {"since": since}).fetchall()

    ip_rows = db.execute(text("""
        SELECT ip_address, COUNT(*) AS cnt
        FROM requests
        WHERE created_at >= :since
          AND decision = 'BLOCK'
        GROUP BY ip_address
        ORDER BY cnt DESC
        LIMIT 10
    """), {"since": since}).fetchall()

    return {
        "top_countries": [{"country": r.country, "count": int(r.cnt)} for r in country_rows],
        "top_ips":       [{"ip": r.ip_address, "count": int(r.cnt)} for r in ip_rows],
    }
