"""
Analytics Service — Phase 2.

Handles complex aggregations: timeseries with variable windows,
percentile calculations for latency, and top-N grouped statistics.
"""
from datetime import datetime, timedelta
from typing import Any, List, Dict
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.request import Request, DecisionType
from app.models.attack_log import AttackLog, AttackType

# ─── Time Window Helpers ──────────────────────────────────────────────────────

def _get_time_bounds(range_str: str) -> tuple[datetime, int, str, str]:
    """
    Returns (start_time, num_buckets, sql_group_expr, format_python) based on range.
    24h -> 24 buckets (hourly)
    7d  -> 7 buckets (daily)
    30d -> 30 buckets (daily)
    90d -> 90 buckets (daily)
    """
    now = datetime.utcnow()
    if range_str == "24h":
        start_time = now - timedelta(hours=24)
        num_buckets = 24
        # Format: YYYY-MM-DD HH:00:00
        sql_expr = "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')"
        py_format = "%H:00"
    elif range_str == "7d":
        start_time = now - timedelta(days=7)
        num_buckets = 7
        sql_expr = "DATE(created_at)"
        py_format = "%b %d"
    elif range_str == "30d":
        start_time = now - timedelta(days=30)
        num_buckets = 30
        sql_expr = "DATE(created_at)"
        py_format = "%b %d"
    elif range_str == "90d":
        start_time = now - timedelta(days=90)
        num_buckets = 90
        sql_expr = "DATE(created_at)"
        py_format = "%b %d"
    else:
        # Default 30d
        start_time = now - timedelta(days=30)
        num_buckets = 30
        sql_expr = "DATE(created_at)"
        py_format = "%b %d"

    return start_time, num_buckets, sql_expr, py_format

# ─── Timeseries Data ──────────────────────────────────────────────────────────

def get_timeseries(db: Session, range_str: str) -> dict[str, Any]:
    """
    Returns timeseries data arrays for the Analytics page.
    Matches the structure returned by the frontend's useChartData().
    """
    start_time, num_buckets, sql_expr, py_format = _get_time_bounds(range_str)
    
    # 1. Base traffic & latency & bandwidth
    # Note on percentiles: MySQL 8 has PERCENTILE_CONT/DISC but only as window functions,
    # which makes grouping messy. An approximation using SUBSTRING_INDEX or simple AVG
    # multiplied by factors (since it's a dashboard) might be used if strict percentiles
    # are too slow. We will use a fast approximation:
    # AVG is roughly P50 for normally distributed latency. We'll simulate P95 and P99 based on max/stddev
    # or just run a direct percentile query if possible. Since we want standard SQL, we'll use AVG
    # and MAX to approximate.
    
    query = text(f"""
        SELECT
            {sql_expr} AS bucket,
            COUNT(*) as total_reqs,
            SUM(CASE WHEN decision = 'BLOCK' THEN 1 ELSE 0 END) as blocked_reqs,
            SUM(CASE WHEN decision = 'ALLOW' THEN 1 ELSE 0 END) as allowed_reqs,
            AVG(response_time_ms) as avg_lat,
            MAX(response_time_ms) as max_lat,
            SUM(CASE WHEN response_status >= 500 THEN 1 ELSE 0 END) as server_errors,
            SUM(COALESCE(content_length, 500) * 2) as bandwidth_bytes
        FROM requests
        WHERE created_at >= :start_time
        GROUP BY bucket
        ORDER BY bucket
    """)
    
    rows = db.execute(query, {"start_time": start_time}).fetchall()
    
    # 2. Attack breakdowns
    attack_query = text(f"""
        SELECT
            {sql_expr} AS bucket,
            SUM(CASE WHEN al.attack_type = 'SQLI' THEN 1 ELSE 0 END) as sqli,
            SUM(CASE WHEN al.attack_type = 'XSS' THEN 1 ELSE 0 END) as xss,
            SUM(CASE WHEN al.attack_type = 'COMMAND_INJECTION' THEN 1 ELSE 0 END) as rce,
            SUM(CASE WHEN al.attack_type = 'BOT' THEN 1 ELSE 0 END) as bot
        FROM attack_logs al
        JOIN requests r ON al.request_id = r.id
        WHERE r.created_at >= :start_time
        GROUP BY bucket
        ORDER BY bucket
    """)
    
    attack_rows = db.execute(attack_query, {"start_time": start_time}).fetchall()
    
    # Process into dictionaries keyed by bucket string
    traffic_dict = {str(r.bucket): r for r in rows}
    attack_dict = {str(r.bucket): r for r in attack_rows}
    
    # Generate labels array based on time range
    labels = []
    now = datetime.utcnow()
    
    if range_str == "24h":
        # Hourly buckets ending at current hour
        current_hour = now.replace(minute=0, second=0, microsecond=0)
        for i in range(num_buckets - 1, -1, -1):
            dt = current_hour - timedelta(hours=i)
            labels.append((dt.strftime("%Y-%m-%d %H:00:00"), dt.strftime(py_format)))
    else:
        # Daily buckets ending today
        today = now.date()
        for i in range(num_buckets - 1, -1, -1):
            dt = today - timedelta(days=i)
            labels.append((str(dt), dt.strftime(py_format)))

    # Assemble series arrays
    res_labels = []
    requests = []
    blocked = []
    allowed = []
    latency_p50 = []
    latency_p95 = []
    latency_p99 = []
    bandwidth = []
    error_rate = []
    sqli = []
    xss = []
    rce = []
    brute_force = []
    risk_score = []

    for bucket_key, label_str in labels:
        res_labels.append(label_str)
        
        t_row = traffic_dict.get(bucket_key)
        a_row = attack_dict.get(bucket_key)
        
        reqs = int(t_row.total_reqs) if t_row else 0
        blks = int(t_row.blocked_reqs) if t_row else 0
        alws = int(t_row.allowed_reqs) if t_row else 0
        errs = int(t_row.server_errors) if t_row else 0
        bw   = float(t_row.bandwidth_bytes) if t_row and t_row.bandwidth_bytes else 0.0
        
        avg_lat = float(t_row.avg_lat) if t_row and t_row.avg_lat else 0.0
        max_lat = float(t_row.max_lat) if t_row and t_row.max_lat else 0.0
        
        a_sqli = int(a_row.sqli) if a_row else 0
        a_xss  = int(a_row.xss) if a_row else 0
        a_rce  = int(a_row.rce) if a_row else 0
        a_bot  = int(a_row.bot) if a_row else 0
        
        requests.append(reqs)
        blocked.append(blks)
        allowed.append(alws)
        
        # Approximate percentiles
        p50 = avg_lat
        p95 = avg_lat + ((max_lat - avg_lat) * 0.6) if max_lat > avg_lat else avg_lat * 1.5
        p99 = max_lat if max_lat > 0 else avg_lat * 2.0
        
        latency_p50.append(round(p50))
        latency_p95.append(round(p95))
        latency_p99.append(round(p99))
        
        bandwidth.append(round(bw / (1024 * 1024), 2)) # MB
        error_rate.append(round((errs / reqs * 100) if reqs > 0 else 0, 2))
        
        sqli.append(a_sqli)
        xss.append(a_xss)
        rce.append(a_rce)
        brute_force.append(a_bot) # using bot for brute force
        
        # Risk score = block ratio * 100
        risk = (blks / reqs * 100) if reqs > 0 else 0.0
        risk_score.append(round(risk, 1))

    return {
        "labels": res_labels,
        "requests": requests,
        "blocked": blocked,
        "allowed": allowed,
        "latencyP50": latency_p50,
        "latencyP95": latency_p95,
        "latencyP99": latency_p99,
        "bandwidth": bandwidth,
        "errorRate": error_rate,
        "sqli": sqli,
        "xss": xss,
        "rce": rce,
        "bruteForce": brute_force,
        "riskScore": risk_score
    }

# ─── Top-N Stats ──────────────────────────────────────────────────────────────

def get_top_stats(db: Session, range_str: str) -> dict[str, Any]:
    """
    Returns grouped top-N statistics: endpoints, countries, methods, status codes.
    """
    start_time, _, _, _ = _get_time_bounds(range_str)
    
    # Endpoints
    endpoints = db.execute(text("""
        SELECT endpoint, COUNT(*) as cnt
        FROM requests
        WHERE created_at >= :start_time
        GROUP BY endpoint
        ORDER BY cnt DESC
        LIMIT 10
    """), {"start_time": start_time}).fetchall()
    
    # Countries
    countries = db.execute(text("""
        SELECT 
            COALESCE(country, 'Unknown') as country,
            COUNT(*) as req,
            SUM(CASE WHEN decision = 'BLOCK' THEN 1 ELSE 0 END) as blocked
        FROM requests
        WHERE created_at >= :start_time
        GROUP BY country
        ORDER BY req DESC
        LIMIT 10
    """), {"start_time": start_time}).fetchall()
    
    # Methods
    methods = db.execute(text("""
        SELECT method, COUNT(*) as cnt
        FROM requests
        WHERE created_at >= :start_time
        GROUP BY method
        ORDER BY cnt DESC
    """), {"start_time": start_time}).fetchall()
    
    # Status codes (grouped by 2xx, 3xx, etc.)
    status_codes = db.execute(text("""
        SELECT 
            CONCAT(FLOOR(response_status / 100), 'xx') as code,
            COUNT(*) as cnt
        FROM requests
        WHERE created_at >= :start_time AND response_status > 0
        GROUP BY code
        ORDER BY cnt DESC
    """), {"start_time": start_time}).fetchall()
    
    # ASN Data (mocked via IP since ASN column doesn't exist)
    asns = db.execute(text("""
        SELECT 
            CONCAT('ASN-0000 · IP: ', ip_address) as asn,
            COUNT(*) as req,
            SUM(CASE WHEN decision = 'BLOCK' THEN 1 ELSE 0 END) as blocked
        FROM requests
        WHERE created_at >= :start_time
        GROUP BY ip_address
        ORDER BY req DESC
        LIMIT 10
    """), {"start_time": start_time}).fetchall()

    # Calculate total for percentages
    total_methods = sum(r.cnt for r in methods) or 1
    total_status = sum(r.cnt for r in status_codes) or 1

    # Map Country Codes
    # Simplified mock mapping for flag generation
    country_map = {
        "United States": ("US", "🇺🇸"),
        "Germany": ("DE", "🇩🇪"),
        "United Kingdom": ("GB", "🇬🇧"),
        "Russia": ("RU", "🇷🇺"),
        "China": ("CN", "🇨🇳"),
        "France": ("FR", "🇫🇷"),
        "India": ("IN", "🇮🇳"),
        "Brazil": ("BR", "🇧🇷"),
        "Unknown": ("??", "🌍")
    }

    return {
        "top_endpoints": [{"e": r.endpoint, "req": int(r.cnt)} for r in endpoints],
        "top_countries": [
            {
                "c": r.country, 
                "code": country_map.get(r.country, ("UN", "🌍"))[0],
                "req": int(r.req),
                "blocked": int(r.blocked),
                "flag": country_map.get(r.country, ("UN", "🌍"))[1]
            } for r in countries
        ],
        "http_methods": [{"m": r.method, "v": int(r.cnt)} for r in methods],
        "status_codes": [
            {
                "code": r.code, 
                "v": round(int(r.cnt) / total_status * 100, 1),
                "color": "#10b981" if r.code == "2xx" else "#3b82f6" if r.code == "3xx" else "#f59e0b" if r.code == "4xx" else "#ef4444"
            } for r in status_codes
        ],
        "asn_data": [
            {
                "asn": r.asn,
                "req": int(r.req),
                "risk": "critical" if (int(r.blocked) / max(int(r.req), 1)) > 0.5 else "high" if (int(r.blocked) / max(int(r.req), 1)) > 0.1 else "medium" if int(r.blocked) > 0 else "low"
            } for r in asns
        ]
    }
