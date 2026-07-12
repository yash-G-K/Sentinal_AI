from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from app.models.request import DecisionType

class Condition(BaseModel):
    id: str
    field: str
    operator: str
    value: str
    negate: bool = False

class VersionEntry(BaseModel):
    version: int
    at: str
    by: str
    summary: str

class FirewallRuleBase(BaseModel):
    name: str = Field(alias="rule_name")
    description: Optional[str] = ""
    rule_type: str = "CUSTOM"
    target: str = "*" # Legacy compat
    priority: int = 100
    enabled: bool = True
    status: str = "Active"
    action: DecisionType
    conditions: List[Condition] = []
    tags: List[str] = []
    category: Optional[str] = None
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None

class FirewallRuleCreate(FirewallRuleBase):
    pass

class FirewallRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, alias="rule_name")
    description: Optional[str] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None
    status: Optional[str] = None
    action: Optional[DecisionType] = None
    conditions: Optional[List[Condition]] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    expires_at: Optional[datetime] = None
    summary: Optional[str] = "Rule updated" # Used for versioning

class FirewallRuleResponse(BaseModel):
    id: int
    rule_name: str
    description: Optional[str] = ""
    rule_type: str = "CUSTOM"
    target: str = "*"
    priority: int = 100
    enabled: bool = True
    status: str = "Active"
    action: str  # Return as plain string so frontend gets "BLOCK"/"ALLOW"
    conditions: List[Any] = []
    tags: List[str] = []
    category: Optional[str] = None
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    hits: int = 0
    version: int = 1
    versions: List[Any] = []  # Remapped from versions_history
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    last_matched_at: Optional[datetime] = None
    avg_execution_time_ms: Optional[float] = None

    @classmethod
    def from_orm_rule(cls, rule) -> "FirewallRuleResponse":
        """Factory that correctly maps ORM field names to response field names."""
        return cls(
            id=rule.id,
            rule_name=rule.rule_name,
            description=rule.description or "",
            rule_type=rule.rule_type or "CUSTOM",
            target=rule.target or "*",
            priority=rule.priority,
            enabled=rule.enabled,
            status=rule.status or "Active",
            action=rule.action.value if hasattr(rule.action, 'value') else str(rule.action),
            conditions=rule.conditions or [],
            tags=rule.tags or [],
            category=rule.category,
            reason=rule.reason,
            expires_at=rule.expires_at,
            hits=rule.hits or 0,
            version=rule.version or 1,
            versions=rule.versions_history or [],  # Key mapping fix
            created_at=rule.created_at,
            updated_at=rule.updated_at,
            created_by=rule.created_by,
            last_matched_at=rule.last_matched_at,
            avg_execution_time_ms=rule.avg_execution_time_ms,
        )

    class Config:
        from_attributes = True

class AIRec(BaseModel):
    id: str
    title: str
    reason: str
    confidence: float
    severity: str
    recommended_action: str
    generated_by: str = "AI"
    explanation: str
    preview_rule: FirewallRuleCreate

class StandardResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None

class SimulationRequest(BaseModel):
    rule: FirewallRuleCreate
    method: str = "GET"
    path: str = "/"
    ip_address: str = "127.0.0.1"
    country: str = "US"
    user_agent: str = "Mozilla/5.0"
    headers: Dict[str, str] = {}
    query_params: Dict[str, str] = {}
    body: str = ""

class SimulationResponse(BaseModel):
    would_match: bool
    action_taken: str
    matched_condition: Optional[Condition] = None
    explanation: str
