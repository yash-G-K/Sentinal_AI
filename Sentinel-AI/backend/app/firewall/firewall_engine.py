import re
import time
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.models.request import DecisionType
from app.models.firewall_rule import FirewallRule
from app.models.blocked_ip import BlockedIP, BlockStatus
from app.models.security_event import SecurityEvent
from app.models.attack_log import SeverityLevel
from app.models.ip_reputation import ReputationStatus
from app.detectors.base import DetectionResult
from app.firewall.rule_cache import rule_cache
from loguru import logger

class FirewallEngine:
    def __init__(self):
        self.temp_block_duration_minutes = 30 # Default
        
        # IPs that are never blocked — localhost, internal services
        self.TRUSTED_IPS = {"127.0.0.1", "::1", "localhost", "0.0.0.0"}
        
        # Path prefixes that bypass WAF rule evaluation — the WAF admin API itself
        self.INTERNAL_PATHS = ("/api/v1/", "/health", "/docs", "/openapi", "/redoc")

    def evaluate(
        self, 
        db: Session, 
        ip_address: str, 
        request_id: Optional[int],
        detector_result: Optional[DetectionResult], 
        rep_status: ReputationStatus,
        request_data: Dict[str, Any]
    ) -> DecisionType:
        """
        Evaluates all signals to determine the final WAF decision.
        request_data should contain: method, path, headers, query_params, body, user_agent, country
        """
        # 0a. Always allow trusted internal IPs (localhost, internal services)
        if ip_address in self.TRUSTED_IPS:
            return DecisionType.ALLOW

        # 0b. Always allow internal WAF management API paths
        request_path = request_data.get("path", "")
        if request_path.startswith(self.INTERNAL_PATHS):
            return DecisionType.ALLOW

        # 1. Check Active Firewall Rules (from in-memory cache)
        rules = rule_cache.get_active_rules()
        now = datetime.utcnow()
        
        for rule in rules:
            # Skip expired rules even if they slipped through cache
            if rule.expires_at and rule.expires_at < now:
                continue
            if self._evaluate_rule(rule, request_data, ip_address):
                self._record_rule_hit(db, rule.id, request_id)
                self._log_security_event(db, request_id, "FIREWALL_MATCH", SeverityLevel.MEDIUM, f"Matched active firewall rule: {rule.rule_name}")
                return rule.action

        # 2. Check IP Reputation Status
        if rep_status == ReputationStatus.BLOCKED:
            self._log_security_event(db, request_id, "REPUTATION_BLOCK", SeverityLevel.HIGH, f"IP {ip_address} is blocked by reputation engine.")
            return DecisionType.BLOCK

        # 3. Evaluate Current Threat Signatures
        if detector_result and detector_result.detected:
            if detector_result.severity in [SeverityLevel.HIGH, SeverityLevel.CRITICAL] or detector_result.confidence >= 90.0:
                self._apply_temporary_block(db, ip_address, f"Auto-blocked due to {detector_result.attack_type.value} detection.")
                self._log_security_event(db, request_id, "THREAT_BLOCK", detector_result.severity, f"Blocked real-time threat: {detector_result.attack_type.value}")
                return DecisionType.BLOCK
            
            if rep_status == ReputationStatus.SUSPICIOUS:
                self._log_security_event(db, request_id, "THREAT_QUARANTINE", SeverityLevel.MEDIUM, "Quarantined due to suspicious reputation and low/med threat.")
                return DecisionType.QUARANTINE

        # 4. Default Allow
        return DecisionType.ALLOW
    
    def _evaluate_rule(self, rule: FirewallRule, request_data: Dict[str, Any], client_ip: str) -> bool:
        """Evaluates a single rule's conditions against the request."""
        # Legacy rule support (where conditions might be empty, but target is set)
        if not rule.conditions:
            if rule.target == "*" or rule.target == client_ip:
                return True
            return False
            
        # ALL conditions must match (AND logic)
        for cond in rule.conditions:
            if not isinstance(cond, dict):
                continue
            if not self._evaluate_condition(cond, request_data, client_ip):
                return False
        
        return True
        
    def _evaluate_condition(self, cond: Dict[str, Any], req: Dict[str, Any], client_ip: str) -> bool:
        field = cond.get("field")
        op = cond.get("operator")
        val = cond.get("value", "")
        negate = cond.get("negate", False)
        
        # Extract target data
        target_data = ""
        if field == "ip":
            target_data = client_ip
        elif field == "path":
            target_data = req.get("path", "")
        elif field == "method":
            target_data = req.get("method", "")
        elif field == "country":
            target_data = req.get("country", "")
        elif field == "user-agent":
            target_data = req.get("user_agent", "")
        elif field == "query-param":
            # For query params, we join them or check if any matches
            target_data = str(req.get("query_params", {}))
        elif field == "header":
            target_data = str(req.get("headers", {}))
        elif field == "body":
            target_data = req.get("body", "")

        target_data = str(target_data)
        
        matched = False
        if op == "equals":
            matched = (target_data == val)
        elif op == "contains":
            matched = (val in target_data)
        elif op == "starts_with":
            matched = target_data.startswith(val)
        elif op == "ends_with":
            matched = target_data.endswith(val)
        elif op == "matches":
            try:
                matched = bool(re.search(val, target_data))
            except:
                matched = False
        elif op == "in_list":
            items = [i.strip() for i in val.split(",")]
            matched = (target_data in items)
        elif op == "not_in":
            items = [i.strip() for i in val.split(",")]
            matched = (target_data not in items)
            
        return not matched if negate else matched

    def _record_rule_hit(self, db: Session, rule_id: int, request_id: Optional[int]):
        """Increments hit counter. Using direct SQL update to avoid ORM object locking issues."""
        from sqlalchemy import text
        try:
            db.execute(
                text(f"UPDATE firewall_rules SET hits = hits + 1, last_matched_at = '{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}' WHERE id = {rule_id}")
            )
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to record rule hit for rule {rule_id}: {e}")
            db.rollback()

    def _apply_temporary_block(self, db: Session, ip_address: str, reason: str):
        existing = db.query(FirewallRule).filter(
            FirewallRule.target == ip_address,
            FirewallRule.rule_type == "AUTO_TEMP",
            FirewallRule.enabled == True
        ).first()

        if existing:
            return

        expires_at = datetime.utcnow() + timedelta(minutes=self.temp_block_duration_minutes)
        new_rule = FirewallRule(
            rule_name=f"TEMP_BLOCK_{ip_address}",
            rule_type="AUTO_TEMP",
            target=ip_address,
            action=DecisionType.BLOCK,
            reason=reason,
            enabled=True,
            status="Active",
            priority=50,
            expires_at=expires_at,
            conditions=[] # Legacy style target block
        )
        db.add(new_rule)
        db.flush()
        
        blocked_entry = BlockedIP(
            ip_address=ip_address,
            rule_id=new_rule.id,
            expires_at=expires_at,
            status=BlockStatus.BLOCKED
        )
        db.add(blocked_entry)
        rule_cache.refresh(db) # Refresh cache to include new temp rule
        logger.warning(f"Firewall created temporary block rule for {ip_address} expiring at {expires_at}")

    def _log_security_event(self, db: Session, request_id: Optional[int], event_type: str, severity: SeverityLevel, message: str):
        if not request_id:
            return
        event = SecurityEvent(
            request_id=request_id,
            event_type=event_type,
            severity=severity,
            message=message,
            source="Firewall Engine"
        )
        db.add(event)

firewall_engine = FirewallEngine()
