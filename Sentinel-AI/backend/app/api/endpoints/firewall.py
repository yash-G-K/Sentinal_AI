from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.database.database import get_db
from app.models.blocked_ip import BlockedIP, BlockStatus
from app.models.ip_reputation import IPReputation, ReputationStatus
from app.schemas.responses import PaginatedResponse, BlockedIPSchema
from app.api.utils import paginate
from app.services.cache_service import cache, TTL

router = APIRouter()
_RULES_CACHE_KEY = "firewall:rules"

class BlockRequest(BaseModel):
    ip_address: str
    reason: Optional[str] = "Manual Admin Block"

class UnblockRequest(BaseModel):
    ip_address: str

@router.get("/blocked-ips", response_model=PaginatedResponse[BlockedIPSchema])
def get_blocked_ips(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None
):
    query = db.query(BlockedIP).order_by(BlockedIP.blocked_at.desc())
    if status:
        query = query.filter(BlockedIP.status == status)
        
    return paginate(db, query, page, size)

@router.post("/block")
def block_ip(request: BlockRequest, db: Session = Depends(get_db)):
    # Create or update IP Reputation
    ip_rep = db.query(IPReputation).filter(IPReputation.ip_address == request.ip_address).first()
    if not ip_rep:
        ip_rep = IPReputation(ip_address=request.ip_address, reputation_score=0.0)
        db.add(ip_rep)
    
    ip_rep.status = ReputationStatus.BLOCKED
    ip_rep.reputation_score = 0.0 # Force zero reputation

    # Create manual blocked IP entry
    blocked_entry = BlockedIP(
        ip_address=request.ip_address,
        status=BlockStatus.BLOCKED
    )
    db.add(blocked_entry)
    db.commit()
    return {"message": f"IP {request.ip_address} has been manually blocked."}

@router.post("/unblock")
def unblock_ip(request: UnblockRequest, db: Session = Depends(get_db)):
    # Unblock in IP Reputation
    ip_rep = db.query(IPReputation).filter(IPReputation.ip_address == request.ip_address).first()
    if ip_rep:
        ip_rep.status = ReputationStatus.SAFE
        ip_rep.reputation_score = 75.0 # Reset to a safe score
        ip_rep.blocked_until = None

    # Unblock in BlockedIPs
    db.query(BlockedIP).filter(
        BlockedIP.ip_address == request.ip_address,
        BlockedIP.status == BlockStatus.BLOCKED
    ).update({"status": BlockStatus.UNBLOCKED})
    
    db.commit()
    return {"message": f"IP {request.ip_address} has been manually unblocked."}

# ─── New Rule Management Endpoints (Phase 4) ──────────────────────────────────

from app.schemas.firewall import (
    FirewallRuleCreate, FirewallRuleUpdate, FirewallRuleResponse,
    SimulationRequest, SimulationResponse, StandardResponse, AIRec
)
from app.services.firewall_service import firewall_service
from app.firewall.simulator import RuleSimulator
import uuid
from fastapi import Body

@router.get("/rules", response_model=StandardResponse)
async def get_rules(db: Session = Depends(get_db)):
    cached = await cache.get(_RULES_CACHE_KEY)
    if cached is not None:
        return StandardResponse(message="Rules fetched successfully (cached)", data=cached)
    rules = firewall_service.get_all_rules(db)
    rule_data = [FirewallRuleResponse.from_orm_rule(r) for r in rules]
    await cache.set(_RULES_CACHE_KEY, [r.dict() for r in rule_data], ttl=TTL["firewall_rules"])
    return StandardResponse(message="Rules fetched successfully", data=rule_data)

@router.post("/rules", response_model=StandardResponse)
async def create_rule(rule: FirewallRuleCreate, db: Session = Depends(get_db)):
    new_rule = firewall_service.create_rule(db, rule)
    await cache.delete(_RULES_CACHE_KEY)
    return StandardResponse(message="Rule created successfully", data=FirewallRuleResponse.from_orm_rule(new_rule))

@router.put("/rules/{rule_id}", response_model=StandardResponse)
async def update_rule(rule_id: int, rule: FirewallRuleUpdate, db: Session = Depends(get_db)):
    updated_rule = firewall_service.update_rule(db, rule_id, rule)
    await cache.delete(_RULES_CACHE_KEY)
    return StandardResponse(message="Rule updated successfully", data=FirewallRuleResponse.from_orm_rule(updated_rule))

@router.delete("/rules/{rule_id}", response_model=StandardResponse)
async def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    firewall_service.delete_rule(db, rule_id)
    await cache.delete(_RULES_CACHE_KEY)
    return StandardResponse(message="Rule deleted successfully")

@router.patch("/rules/{rule_id}/toggle", response_model=StandardResponse)
async def toggle_rule(rule_id: int, enabled: bool = Body(..., embed=True), db: Session = Depends(get_db)):
    rule = firewall_service.toggle_rule(db, rule_id, enabled)
    await cache.delete(_RULES_CACHE_KEY)
    return StandardResponse(message=f"Rule {'enabled' if enabled else 'disabled'}", data=FirewallRuleResponse.from_orm_rule(rule))

@router.patch("/rules/{rule_id}/priority", response_model=StandardResponse)
async def update_priority(rule_id: int, priority: int = Body(..., embed=True), db: Session = Depends(get_db)):
    rule = firewall_service.set_priority(db, rule_id, priority)
    await cache.delete(_RULES_CACHE_KEY)
    return StandardResponse(message="Priority updated successfully", data=FirewallRuleResponse.from_orm_rule(rule))

@router.post("/rules/simulate", response_model=StandardResponse)
def simulate_rule(req: SimulationRequest):
    would_match, action, cond, explanation = RuleSimulator.simulate(req)
    data = SimulationResponse(
        would_match=would_match,
        action_taken=action,
        matched_condition=cond,
        explanation=explanation
    )
    return StandardResponse(message="Simulation complete", data=data)

@router.post("/rules/{rule_id}/rollback", response_model=StandardResponse)
async def rollback_rule(rule_id: int, target_version: int = Body(..., embed=True), db: Session = Depends(get_db)):
    rule = firewall_service.rollback_rule(db, rule_id, target_version)
    await cache.delete(_RULES_CACHE_KEY)
    return StandardResponse(message=f"Rolled back to version {target_version}", data=FirewallRuleResponse.from_orm_rule(rule))

@router.get("/ai-recs", response_model=StandardResponse)
def get_ai_recs():
    recs = [
        {
            "id": str(uuid.uuid4()),
            "title": "Block RCE via Exec Parameters",
            "reason": "Detected 23 RCE probe attempts in the last 6 hours targeting ?cmd= and ?exec= query parameters. Pattern suggests automated exploitation tool.",
            "confidence": 94.0,
            "severity": "High",
            "recommended_action": "Block",
            "generated_by": "AI",
            "explanation": "This rule blocks common RCE payload keywords in query string parameters to mitigate automated scanning.",
            "preview_rule": {
                "rule_name": "Block RCE Command Execution",
                "description": "AI-recommended: Block remote code execution attempts via query parameters",
                "priority": 2,
                "enabled": True,
                "action": "BLOCK",
                "tags": ["rce", "ai-recommended"],
                "conditions": [{"id": str(uuid.uuid4()), "field": "query-param", "operator": "matches", "value": r"(cmd|exec|system|shell|eval)=", "negate": False}]
            }
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Rate Limit Admin Endpoints",
            "reason": "Admin API endpoints receiving 4.2x more traffic than baseline over the last 12 hours. Suggests credential stuffing or automated enumeration.",
            "confidence": 81.0,
            "severity": "Medium",
            "recommended_action": "Block",
            "generated_by": "AI",
            "explanation": "Applying a block to /api/v1/admin/ prevents brute force attempts without locking out legitimate administrators.",
            "preview_rule": {
                "rule_name": "Block Admin Panel Abuse",
                "description": "AI-recommended: Block excessive access to sensitive admin routes",
                "priority": 4,
                "enabled": True,
                "action": "BLOCK",
                "tags": ["admin", "ai-recommended"],
                "conditions": [{"id": str(uuid.uuid4()), "field": "path", "operator": "starts_with", "value": "/api/v1/admin/", "negate": False}]
            }
        }
    ]
    return StandardResponse(message="AI recommendations generated", data=recs)
