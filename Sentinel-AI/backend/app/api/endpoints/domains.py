"""
app/api/endpoints/domains.py

CRUD + Stats for Protected Domains.

GET    /api/v1/domains               - list all (non-deleted) domains with live counts
POST   /api/v1/domains               - register new domain
PUT    /api/v1/domains/{id}          - update domain
DELETE /api/v1/domains/{id}          - soft delete
POST   /api/v1/domains/{id}/health   - trigger health check now
GET    /api/v1/domains/{id}/stats    - rich per-domain stats (powers detail drawer)
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import time

from app.database.database import get_db
from app.models.protected_domain import ProtectedDomain
from app.models.request import Request, DecisionType
from app.models.attack_log import AttackLog, AttackType

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class DomainCreateRequest(BaseModel):
    name: str
    host: str
    origin_url: str
    description: Optional[str] = None
    app_type: str = "Custom"
    environment: str = "Docker"
    protection_mode: str = "block"
    owner: Optional[str] = None
    team: Optional[str] = None
    business_unit: Optional[str] = None
    criticality: str = "Medium"
    internet_facing: bool = True
    production: bool = False
    ssl_enabled: bool = False
    proxy_enabled: bool = False
    proxy_port: Optional[int] = None
    listen_port: Optional[int] = None
    upstream_port: Optional[int] = None
    tags: Optional[List[str]] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class DomainUpdateRequest(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    origin_url: Optional[str] = None
    description: Optional[str] = None
    app_type: Optional[str] = None
    environment: Optional[str] = None
    protection_mode: Optional[str] = None
    owner: Optional[str] = None
    team: Optional[str] = None
    business_unit: Optional[str] = None
    criticality: Optional[str] = None
    internet_facing: Optional[bool] = None
    production: Optional[bool] = None
    ssl_enabled: Optional[bool] = None
    proxy_enabled: Optional[bool] = None
    proxy_port: Optional[int] = None
    listen_port: Optional[int] = None
    upstream_port: Optional[int] = None
    tags: Optional[List[str]] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    enabled: Optional[bool] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _relative(dt: Optional[datetime]) -> Optional[str]:
    """Return a human-readable relative time string."""
    if not dt:
        return None
    diff = datetime.utcnow() - dt
    secs = int(diff.total_seconds())
    if secs < 60:
        return f"{secs}s ago"
    elif secs < 3600:
        return f"{secs // 60}m ago"
    elif secs < 86400:
        return f"{secs // 3600}h ago"
    else:
        return f"{secs // 86400}d ago"


def _compute_risk(attacks_24h: int, blocked_24h: int, status: str) -> str:
    """Simple risk scoring based on attack volume and domain status."""
    if status in ("under_attack",):
        if attacks_24h >= 100:
            return "critical"
        return "high"
    if attacks_24h >= 200:
        return "critical"
    if attacks_24h >= 50:
        return "high"
    if attacks_24h >= 10:
        return "medium"
    if attacks_24h > 0:
        return "low"
    return "none"


def _domain_24h_counts(db: Session, host: str):
    """Return (requests, blocked, attacks) counts for the past 24 hours for a given host."""
    since = datetime.utcnow() - timedelta(hours=24)
    requests_24h = db.query(func.count(Request.id)).filter(
        Request.host == host,
        Request.created_at >= since,
    ).scalar() or 0

    blocked_24h = db.query(func.count(Request.id)).filter(
        Request.host == host,
        Request.decision == DecisionType.BLOCK,
        Request.created_at >= since,
    ).scalar() or 0

    attacks_24h = db.query(func.count(AttackLog.id)).join(
        Request, AttackLog.request_id == Request.id
    ).filter(
        Request.host == host,
        AttackLog.detected_at >= since,
    ).scalar() or 0

    return requests_24h, blocked_24h, attacks_24h


def _serialize_domain(d: ProtectedDomain, db: Session) -> dict:
    """Serialize a ProtectedDomain ORM object to a dict including live counts."""
    r24, b24, a24 = _domain_24h_counts(db, d.host)
    risk = _compute_risk(a24, b24, d.status)

    # Top attack type in 24h
    since = datetime.utcnow() - timedelta(hours=24)
    top_attack_row = db.query(
        AttackLog.attack_type, func.count(AttackLog.id).label("cnt")
    ).join(Request, AttackLog.request_id == Request.id).filter(
        Request.host == d.host,
        AttackLog.detected_at >= since,
    ).group_by(AttackLog.attack_type).order_by(func.count(AttackLog.id).desc()).first()

    top_attack = top_attack_row.attack_type if top_attack_row else None

    return {
        "id":               d.id,
        "name":             d.name,
        "host":             d.host,
        "origin_url":       d.origin_url,
        "description":      d.description,
        "app_type":         d.app_type,
        "environment":      d.environment,
        "icon":             d.icon,
        "color":            d.color,
        "status":           d.status,
        "risk":             risk,
        "enabled":          d.enabled,
        "protection_mode":  d.protection_mode,
        "owner":            d.owner,
        "team":             d.team,
        "business_unit":    d.business_unit,
        "criticality":      d.criticality,
        "internet_facing":  d.internet_facing,
        "production":       d.production,
        "health_status":    d.health_status,
        "health_latency_ms": d.health_latency_ms,
        "last_seen":        _relative(d.last_seen),
        "last_request_at":  _relative(d.last_request_at),
        "last_attack_at":   _relative(d.last_attack_at),
        "last_block_at":    _relative(d.last_block_at),
        "ssl_enabled":      d.ssl_enabled,
        "ssl_expiry":       d.ssl_expiry.isoformat() if d.ssl_expiry else None,
        "tls_version":      d.tls_version,
        "https_redirect":   d.https_redirect,
        "proxy_enabled":    d.proxy_enabled,
        "proxy_port":       d.proxy_port,
        "listen_port":      d.listen_port,
        "upstream_port":    d.upstream_port,
        "tags":             d.tags or [],
        "created_at":       d.created_at.isoformat() if d.created_at else None,
        "updated_at":       d.updated_at.isoformat() if d.updated_at else None,
        # Live 24h stats embedded in list view
        "stats_24h": {
            "requests": r24,
            "blocked":  b24,
            "attacks":  a24,
            "top_attack": top_attack,
        },
    }


# ── Health check helper (sync, runs inline) ────────────────────────────────────

def _run_health_check(domain: ProtectedDomain, db: Session) -> dict:
    """Performs a HEAD request to origin_url and updates the domain record."""
    import urllib.request
    import urllib.error

    url = domain.origin_url.rstrip("/") + "/"
    start = time.time()
    http_status = None
    latency_ms = None
    new_status = "unreachable"

    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "Sentinel-AI/1.0 HealthCheck")
        with urllib.request.urlopen(req, timeout=5) as resp:
            http_status = resp.status
            latency_ms = round((time.time() - start) * 1000, 1)
            new_status = "healthy" if http_status < 400 else "warning"
    except urllib.error.HTTPError as e:
        http_status = e.code
        latency_ms = round((time.time() - start) * 1000, 1)
        new_status = "warning"
    except Exception:
        new_status = "unreachable"

    domain.health_status = http_status
    domain.health_latency_ms = latency_ms
    domain.last_seen = datetime.utcnow() if new_status in ("healthy", "warning") else domain.last_seen
    domain.status = new_status
    db.commit()
    db.refresh(domain)

    return {
        "http_status":  http_status,
        "latency_ms":   latency_ms,
        "status":       new_status,
        "checked_at":   datetime.utcnow().isoformat(),
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
def list_domains(db: Session = Depends(get_db)):
    """List all non-deleted protected domains with live 24h counts."""
    domains = db.query(ProtectedDomain).filter(
        ProtectedDomain.deleted_at == None
    ).order_by(ProtectedDomain.created_at.desc()).all()

    data = [_serialize_domain(d, db) for d in domains]

    # Summary counts
    total      = len(data)
    healthy    = sum(1 for d in data if d["status"] == "healthy")
    offline    = sum(1 for d in data if d["status"] in ("offline", "unreachable"))
    monitoring = sum(1 for d in data if d["protection_mode"] == "log_only")
    under_attack = sum(1 for d in data if d["stats_24h"]["attacks"] > 0)

    return JSONResponse({
        "success": True,
        "data": data,
        "summary": {
            "total":        total,
            "healthy":      healthy,
            "offline":      offline,
            "monitoring":   monitoring,
            "under_attack": under_attack,
        }
    })


@router.post("", status_code=201)
def create_domain(body: DomainCreateRequest, db: Session = Depends(get_db)):
    """Register a new protected domain."""
    existing = db.query(ProtectedDomain).filter(
        ProtectedDomain.host == body.host,
        ProtectedDomain.deleted_at == None,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A domain with host '{body.host}' is already registered.")

    domain = ProtectedDomain(
        name=body.name,
        host=body.host,
        origin_url=body.origin_url,
        description=body.description,
        app_type=body.app_type,
        environment=body.environment,
        protection_mode=body.protection_mode,
        owner=body.owner,
        team=body.team,
        business_unit=body.business_unit,
        criticality=body.criticality,
        internet_facing=body.internet_facing,
        production=body.production,
        ssl_enabled=body.ssl_enabled,
        proxy_enabled=body.proxy_enabled,
        proxy_port=body.proxy_port,
        listen_port=body.listen_port,
        upstream_port=body.upstream_port,
        tags=body.tags or [],
        icon=body.icon,
        color=body.color,
        status="unknown",
        risk="none",
        enabled=True,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)

    # Run initial health check
    _run_health_check(domain, db)

    return JSONResponse({"success": True, "data": _serialize_domain(domain, db)})


@router.put("/{domain_id}")
def update_domain(domain_id: int, body: DomainUpdateRequest, db: Session = Depends(get_db)):
    """Update a protected domain."""
    domain = db.query(ProtectedDomain).filter(
        ProtectedDomain.id == domain_id,
        ProtectedDomain.deleted_at == None,
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found.")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(domain, key, value)

    domain.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(domain)
    return JSONResponse({"success": True, "data": _serialize_domain(domain, db)})


@router.delete("/{domain_id}")
def delete_domain(domain_id: int, db: Session = Depends(get_db)):
    """Soft-delete a protected domain."""
    domain = db.query(ProtectedDomain).filter(
        ProtectedDomain.id == domain_id,
        ProtectedDomain.deleted_at == None,
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found.")

    domain.deleted_at = datetime.utcnow()
    domain.enabled = False
    db.commit()
    return JSONResponse({"success": True, "message": f"Domain '{domain.name}' has been removed."})


@router.post("/{domain_id}/health")
def health_check(domain_id: int, db: Session = Depends(get_db)):
    """Run an on-demand health check against the domain's origin URL."""
    domain = db.query(ProtectedDomain).filter(
        ProtectedDomain.id == domain_id,
        ProtectedDomain.deleted_at == None,
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found.")

    result = _run_health_check(domain, db)
    return JSONResponse({"success": True, "data": result})


@router.get("/{domain_id}/stats")
def get_domain_stats(domain_id: int, hours: int = 24, db: Session = Depends(get_db)):
    """
    Rich per-domain statistics endpoint.
    Powers the domain detail drawer (Overview / Traffic / Attacks / Events).
    """
    domain = db.query(ProtectedDomain).filter(
        ProtectedDomain.id == domain_id,
        ProtectedDomain.deleted_at == None,
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found.")

    since = datetime.utcnow() - timedelta(hours=hours)
    host  = domain.host

    # ── Traffic ──────────────────────────────────────────────────────────────
    total_req = db.query(func.count(Request.id)).filter(
        Request.host == host, Request.created_at >= since
    ).scalar() or 0

    blocked_req = db.query(func.count(Request.id)).filter(
        Request.host == host, Request.decision == DecisionType.BLOCK,
        Request.created_at >= since
    ).scalar() or 0

    allowed_req = total_req - blocked_req

    avg_latency = db.query(func.avg(Request.response_time_ms)).filter(
        Request.host == host, Request.created_at >= since,
        Request.response_time_ms != None
    ).scalar()
    avg_latency = round(float(avg_latency), 1) if avg_latency else None

    # ── Attack breakdown ──────────────────────────────────────────────────────
    attack_rows = db.query(
        AttackLog.attack_type, func.count(AttackLog.id).label("cnt")
    ).join(Request, AttackLog.request_id == Request.id).filter(
        Request.host == host, AttackLog.detected_at >= since
    ).group_by(AttackLog.attack_type).all()

    attacks_by_type = {
        row.attack_type if isinstance(row.attack_type, str) else row.attack_type.value: row.cnt
        for row in attack_rows
    }
    total_attacks = sum(attacks_by_type.values())

    # ── Timeline (requests + attacks per hour) ────────────────────────────────
    timeline = []
    for i in range(hours, 0, -1):
        bucket_start = datetime.utcnow() - timedelta(hours=i)
        bucket_end   = bucket_start + timedelta(hours=1)
        req_count = db.query(func.count(Request.id)).filter(
            Request.host == host,
            Request.created_at >= bucket_start,
            Request.created_at < bucket_end,
        ).scalar() or 0
        atk_count = db.query(func.count(AttackLog.id)).join(
            Request, AttackLog.request_id == Request.id
        ).filter(
            Request.host == host,
            AttackLog.detected_at >= bucket_start,
            AttackLog.detected_at < bucket_end,
        ).scalar() or 0
        timeline.append({
            "hour":     bucket_start.strftime("%H:%M"),
            "requests": req_count,
            "attacks":  atk_count,
        })

    # ── Top IPs ───────────────────────────────────────────────────────────────
    top_ip_rows = db.query(
        Request.ip_address, func.count(Request.id).label("cnt")
    ).filter(
        Request.host == host, Request.created_at >= since
    ).group_by(Request.ip_address).order_by(func.count(Request.id).desc()).limit(10).all()

    top_ips = [{"ip": row.ip_address, "count": row.cnt} for row in top_ip_rows]

    # ── Top Countries ─────────────────────────────────────────────────────────
    top_country_rows = db.query(
        Request.country, func.count(Request.id).label("cnt")
    ).filter(
        Request.host == host, Request.created_at >= since,
        Request.country != None,
    ).group_by(Request.country).order_by(func.count(Request.id).desc()).limit(10).all()

    top_countries = [{"country": row.country, "count": row.cnt} for row in top_country_rows]

    # ── HTTP Methods ──────────────────────────────────────────────────────────
    method_rows = db.query(
        Request.method, func.count(Request.id).label("cnt")
    ).filter(
        Request.host == host, Request.created_at >= since
    ).group_by(Request.method).all()

    methods = {
        (row.method if isinstance(row.method, str) else row.method.value): row.cnt
        for row in method_rows
    }

    # ── HTTP Status Codes ─────────────────────────────────────────────────────
    status_rows = db.query(
        Request.response_status, func.count(Request.id).label("cnt")
    ).filter(
        Request.host == host, Request.created_at >= since,
        Request.response_status != None,
    ).group_by(Request.response_status).order_by(func.count(Request.id).desc()).limit(10).all()

    status_codes = [{"code": row.response_status, "count": row.cnt} for row in status_rows]

    # ── Recent Security Events ────────────────────────────────────────────────
    from app.models.security_event import SecurityEvent
    recent_events_q = db.query(SecurityEvent).join(
        Request, SecurityEvent.request_id == Request.id
    ).filter(
        Request.host == host,
        SecurityEvent.created_at >= since,
    ).order_by(SecurityEvent.created_at.desc()).limit(20).all()

    recent_events = [
        {
            "id":         e.id,
            "event_type": e.event_type,
            "severity":   e.severity if isinstance(e.severity, str) else e.severity.value,
            "message":    e.message,
            "source":     e.source,
            "created_at": _relative(e.created_at),
        }
        for e in recent_events_q
    ]

    # ── Recent Attacks ────────────────────────────────────────────────────────
    recent_attack_q = db.query(AttackLog).join(
        Request, AttackLog.request_id == Request.id
    ).filter(
        Request.host == host,
        AttackLog.detected_at >= since,
    ).order_by(AttackLog.detected_at.desc()).limit(20).all()

    recent_attacks = [
        {
            "id":              a.id,
            "attack_type":     a.attack_type if isinstance(a.attack_type, str) else a.attack_type.value,
            "severity":        a.severity if isinstance(a.severity, str) else a.severity.value,
            "confidence":      float(a.confidence),
            "blocked":         a.blocked,
            "payload_snippet": a.payload_snippet,
            "detected_at":     _relative(a.detected_at),
        }
        for a in recent_attack_q
    ]

    # ── Risk ──────────────────────────────────────────────────────────────────
    risk = _compute_risk(total_attacks, blocked_req, domain.status)

    return JSONResponse({
        "success": True,
        "domain": _serialize_domain(domain, db),
        "period_hours": hours,
        "traffic": {
            "requests": total_req,
            "blocked":  blocked_req,
            "allowed":  allowed_req,
            "avg_latency_ms": avg_latency,
        },
        "attacks": {
            **attacks_by_type,
            "_total": total_attacks,
        },
        "timeline": timeline,
        "top_ips": top_ips,
        "top_countries": top_countries,
        "methods": methods,
        "status_codes": status_codes,
        "recent_events": recent_events,
        "recent_attacks": recent_attacks,
        "risk": risk,
    })
