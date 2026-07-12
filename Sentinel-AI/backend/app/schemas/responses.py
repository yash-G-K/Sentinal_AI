from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

class DashboardSummary(BaseModel):
    """Legacy summary endpoint — kept for backward compatibility."""
    total_requests: int
    total_attacks: int
    total_blocked_ips: int
    recent_security_events: int
    attacks_by_type: List[dict]
    requests_over_time: List[dict]


# ── Phase 1 Dashboard Schemas ─────────────────────────────────────────────────

class KpiValue(BaseModel):
    """A single KPI metric with its trend percentage."""
    value: float
    trend: float


class DashboardKpis(BaseModel):
    """
    All 8 KPI cards for the Dashboard page.
    Matches the kpis[] array structure in Dashboard.tsx.
    """
    total_requests:   KpiValue
    blocked_requests: KpiValue
    allowed_requests: KpiValue
    threat_score:     KpiValue
    critical_alerts:  KpiValue
    avg_response_ms:  KpiValue
    firewall_health:  KpiValue
    ai_confidence:    KpiValue


class TrafficChart(BaseModel):
    """24-hour traffic breakdown for trafficTrendOption and blockedVsAllowedOption."""
    labels:  List[str]
    allowed: List[int]
    blocked: List[int]


class AttackTimelineChart(BaseModel):
    """24-hour attack timeline by severity for attackTimelineOption."""
    labels:   List[str]
    critical: List[int]
    high:     List[int]
    medium:   List[int]
    low:      List[int]


class RiskTrendChart(BaseModel):
    """30-day daily risk scores for riskTrendOption."""
    labels: List[str]
    scores: List[float]


class GeoEntry(BaseModel):
    country: str
    count:   int


class IPEntry(BaseModel):
    ip:    str
    count: int


class GeoData(BaseModel):
    """Geographic attack origin data for the AttackMap sidebar."""
    top_countries: List[GeoEntry]
    top_ips:       List[IPEntry]


class DashboardCharts(BaseModel):
    """All chart data for the Dashboard in a single response."""
    traffic:         TrafficChart
    attack_timeline: AttackTimelineChart
    risk_trend:      RiskTrendChart
    geo:             GeoData


# ── Phase 2 Analytics Schemas ─────────────────────────────────────────────────

class AnalyticsTimeseries(BaseModel):
    labels: List[str]
    requests: List[int]
    blocked: List[int]
    allowed: List[int]
    latencyP50: List[int]
    latencyP95: List[int]
    latencyP99: List[int]
    bandwidth: List[float]
    errorRate: List[float]
    sqli: List[int]
    xss: List[int]
    rce: List[int]
    bruteForce: List[int]
    riskScore: List[float]

class TopEndpoint(BaseModel):
    e: str
    req: int

class TopCountry(BaseModel):
    c: str
    code: str
    req: int
    blocked: int
    flag: str

class HttpMethod(BaseModel):
    m: str
    v: int

class StatusCode(BaseModel):
    code: str
    v: float
    color: str

class AsnData(BaseModel):
    asn: str
    req: int
    risk: str

class AnalyticsTopStats(BaseModel):
    top_endpoints: List[TopEndpoint]
    top_countries: List[TopCountry]
    http_methods: List[HttpMethod]
    status_codes: List[StatusCode]
    asn_data: List[AsnData]


# ── Phase 3 Threat Intelligence Schemas ───────────────────────────────────────

class ThreatSummary(BaseModel):
    risk_score: int
    risk_level: str
    ai_confidence: int
    detection_rate: float
    false_positive_rate: float
    total_requests: int
    blocked_requests: int
    attack_events: int
    ai_analyses: int

class AttackCategory(BaseModel):
    label: str
    type: str
    count: int
    pct: int
    color: str
    trend: int

class MitreAttack(BaseModel):
    id: str
    name: str
    tactic: str
    type: str
    count: int
    risk: str

class EmergingThreat(BaseModel):
    id: int
    name: str
    severity: str
    confidence: int
    description: str
    detectedAt: str
    affectedSystems: List[str]
    ip: str
    recommendation: str

class IOC(BaseModel):
    type: str
    value: str
    tag: str
    risk: str
    seen: int

class AIInsight(BaseModel):
    text: str
    model: str
    confidence: int

class Recommendation(BaseModel):
    id: int
    action: str
    effort: str
    impact: str
    done: bool

class ThreatIntelligenceResponse(BaseModel):
    summary: ThreatSummary
    attack_categories: List[AttackCategory]
    mitre_attacks: List[MitreAttack]
    emerging_threats: List[EmergingThreat]
    iocs: List[IOC]
    ai_insight: AIInsight
    recommendations: List[Recommendation]


# ── Request & Attack Schemas ───────────────────────────────────────────────────

class RequestSchema(BaseModel):
    id: int
    request_uuid: str
    ip_address: str
    method: str
    protocol: str
    host: str
    endpoint: str
    full_url: str
    response_status: int
    response_time_ms: int
    decision: str
    country: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime

    @field_validator("decision", mode="before")
    @classmethod
    def lowercase_decision(cls, v: str) -> str:
        """Frontend expects 'allowed'/'blocked'/'quarantine' — DB stores 'ALLOW'/'BLOCK'/'QUARANTINE'."""
        return v.lower() if isinstance(v, str) else v

    model_config = ConfigDict(from_attributes=True)

class AttackLogSchema(BaseModel):
    id: int
    request_id: Optional[int]
    attack_type: str
    severity: str
    confidence: float
    detector: str
    matched_pattern: Optional[str]
    payload_snippet: Optional[str]
    blocked: bool
    action: str
    detected_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BlockedIPSchema(BaseModel):
    id: int
    ip_address: str
    rule_id: Optional[int]
    status: str
    blocked_at: datetime
    expires_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)

class SecurityEventSchema(BaseModel):
    id: int
    event_type: str
    severity: str
    message: str
    source: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ThreatReportSchema(BaseModel):
    id: int
    report_name: str
    total_requests: int
    blocked_requests: int
    top_attack: Optional[str]
    top_ip: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class IPReputationSchema(BaseModel):
    ip_address: str
    reputation_score: float
    total_requests: int
    malicious_requests: int
    blocked_requests: int
    status: str
    blocked_until: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
