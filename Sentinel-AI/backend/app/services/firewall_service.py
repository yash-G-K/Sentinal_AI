from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from fastapi import HTTPException
from app.models.firewall_rule import FirewallRule
from app.models.audit_log import AuditSeverity, AuditCategory, AuditAction, AuditActorType
from app.schemas.firewall import FirewallRuleCreate, FirewallRuleUpdate, VersionEntry
from app.firewall.rule_cache import rule_cache
from app.firewall.rule_validator import RuleValidator, ValidationError
from app.services.audit_service import audit_service
import copy

class FirewallService:
    def get_all_rules(self, db: Session) -> List[FirewallRule]:
        return db.query(FirewallRule).order_by(FirewallRule.priority.desc()).all()

    def get_rule_by_id(self, db: Session, rule_id: int) -> Optional[FirewallRule]:
        return db.query(FirewallRule).filter(FirewallRule.id == rule_id).first()

    def create_rule(self, db: Session, rule_in: FirewallRuleCreate, user_email: str = "system") -> FirewallRule:
        try:
            RuleValidator.validate_create(rule_in)
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Validate rule name is non-empty
        if not rule_in.name or not rule_in.name.strip():
            raise HTTPException(status_code=400, detail="Rule name cannot be empty.")

        # Check for duplicates by name
        if db.query(FirewallRule).filter(FirewallRule.rule_name == rule_in.name).first():
            raise HTTPException(status_code=400, detail=f"Rule with name '{rule_in.name}' already exists.")

        now = datetime.utcnow()
        new_version = VersionEntry(
            version=1,
            at=now.isoformat(),
            by=user_email,
            summary="Initial rule creation"
        )
        
        rule = FirewallRule(
            rule_name=rule_in.name,
            description=rule_in.description,
            rule_type=rule_in.rule_type,
            target=rule_in.target,
            action=rule_in.action,
            enabled=rule_in.enabled,
            status=rule_in.status,
            priority=rule_in.priority,
            conditions=[c.model_dump() for c in rule_in.conditions],
            tags=rule_in.tags,
            category=rule_in.category,
            reason=rule_in.reason,
            expires_at=rule_in.expires_at,
            hits=0,
            version=1,
            versions_history=[new_version.model_dump()]
        )
        
        db.add(rule)
        db.commit()
        db.refresh(rule)
        
        audit_service.log_action(
            db, severity=AuditSeverity.INFO, category=AuditCategory.FIREWALL,
            action=AuditAction.CREATED, actor_type=AuditActorType.USER,
            actor_name=user_email, resource=f"rule:{rule.rule_name}",
            message=f"Firewall rule created: {rule.rule_name}",
            meta_data={"priority": rule.priority, "action": str(rule.action), "rule_type": rule.rule_type},
            diff_before={}, diff_after={"rule_name": rule.rule_name, "enabled": rule.enabled, "priority": rule.priority}
        )
        rule_cache.refresh(db)
        return rule

    def update_rule(self, db: Session, rule_id: int, rule_in: FirewallRuleUpdate, user_email: str = "system") -> FirewallRule:
        rule = self.get_rule_by_id(db, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
            
        try:
            RuleValidator.validate_update(rule_in)
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Check duplicate name if name is changed
        if rule_in.name and rule_in.name != rule.rule_name:
            if db.query(FirewallRule).filter(FirewallRule.rule_name == rule_in.name).first():
                raise HTTPException(status_code=400, detail=f"Rule with name '{rule_in.name}' already exists.")

        update_data = rule_in.model_dump(exclude_unset=True)
        summary = update_data.pop("summary", "Rule updated")
        
        # Bump version and add history
        new_version_num = rule.version + 1
        history = list(rule.versions_history) if rule.versions_history else []
        history.insert(0, VersionEntry(
            version=new_version_num,
            at=datetime.utcnow().isoformat(),
            by=user_email,
            summary=summary
        ).model_dump())
        
        rule.version = new_version_num
        rule.versions_history = history

        if "conditions" in update_data:
            rule.conditions = [c for c in update_data["conditions"]]

        for field, value in update_data.items():
            if field != "conditions":
                setattr(rule, field, value)

        db.commit()
        db.refresh(rule)
        
        audit_service.log_action(
            db, severity=AuditSeverity.MEDIUM, category=AuditCategory.POLICY,
            action=AuditAction.MODIFIED, actor_type=AuditActorType.USER,
            actor_name=user_email, resource=f"rule:{rule.rule_name}",
            message=f"Firewall rule updated: {rule.rule_name} (v{rule.version})",
            meta_data={"version": rule.version, "summary": summary},
        )
        rule_cache.refresh(db)
        return rule

    def toggle_rule(self, db: Session, rule_id: int, enabled: bool, user_email: str = "system") -> FirewallRule:
        rule = self.get_rule_by_id(db, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
            
        rule.enabled = enabled
        rule.status = "Active" if enabled else "Disabled"
        db.commit()
        db.refresh(rule)
        
        audit_service.log_action(
            db,
            severity=AuditSeverity.INFO if enabled else AuditSeverity.MEDIUM,
            category=AuditCategory.FIREWALL,
            action=AuditAction.MODIFIED, actor_type=AuditActorType.USER,
            actor_name=user_email, resource=f"rule:{rule.rule_name}",
            message=f"Firewall rule {'enabled' if enabled else 'disabled'}: {rule.rule_name}",
            meta_data={"enabled": enabled},
            diff_before={"enabled": not enabled}, diff_after={"enabled": enabled}
        )
        rule_cache.refresh(db)
        return rule

    def set_priority(self, db: Session, rule_id: int, new_priority: int, user_email: str = "system") -> FirewallRule:
        rule = self.get_rule_by_id(db, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
            
        rule.priority = new_priority
        db.commit()
        db.refresh(rule)
        
        audit_service.log_action(
            db, severity=AuditSeverity.LOW, category=AuditCategory.FIREWALL,
            action=AuditAction.MODIFIED, actor_type=AuditActorType.USER,
            actor_name=user_email, resource=f"rule:{rule.rule_name}",
            message=f"Priority of {rule.rule_name} changed to {new_priority}",
            meta_data={"new_priority": new_priority}
        )
        rule_cache.refresh(db)
        return rule

    def delete_rule(self, db: Session, rule_id: int, user_email: str = "system"):
        rule = self.get_rule_by_id(db, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
            
        name = rule.rule_name
        db.delete(rule)
        db.commit()
        
        audit_service.log_action(
            db, severity=AuditSeverity.HIGH, category=AuditCategory.POLICY,
            action=AuditAction.DELETED, actor_type=AuditActorType.USER,
            actor_name=user_email, resource=f"rule:{name}",
            message=f"Firewall rule deleted: {name}",
            diff_before={"rule_name": name}, diff_after={}
        )
        rule_cache.refresh(db)

    def rollback_rule(self, db: Session, rule_id: int, target_version: int, user_email: str = "system") -> FirewallRule:
        """
        Rollback logic: In a real system, you'd store full JSON snapshots in versions_history or an audit table.
        For this simulation, if we don't have the snapshot, we'll return a 501.
        """
        raise HTTPException(status_code=501, detail="Rollback full payload snapshots not yet implemented in history schema.")

firewall_service = FirewallService()
