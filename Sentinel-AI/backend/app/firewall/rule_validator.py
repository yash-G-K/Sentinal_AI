import re
from typing import List
from app.schemas.firewall import FirewallRuleCreate, FirewallRuleUpdate, Condition
from app.models.request import DecisionType

class ValidationError(Exception):
    pass

class RuleValidator:
    ALLOWED_FIELDS = {"ip", "path", "method", "country", "user-agent", "query-param", "header", "body"}
    ALLOWED_OPERATORS = {"equals", "contains", "starts_with", "ends_with", "matches", "in_list", "not_in"}
    ALLOWED_ACTIONS = {d.value for d in DecisionType}

    @classmethod
    def validate_create(cls, rule: FirewallRuleCreate):
        cls._validate_base(rule)
        if not rule.conditions:
            raise ValidationError("Rule must have at least one condition.")

    @classmethod
    def validate_update(cls, rule: FirewallRuleUpdate):
        if rule.action and rule.action.value not in cls.ALLOWED_ACTIONS:
             raise ValidationError(f"Invalid action: {rule.action.value}")
        if rule.conditions is not None:
             cls._validate_conditions(rule.conditions)

    @classmethod
    def _validate_base(cls, rule: FirewallRuleCreate):
        if rule.action.value not in cls.ALLOWED_ACTIONS:
             raise ValidationError(f"Invalid action: {rule.action.value}")
        cls._validate_conditions(rule.conditions)

    @classmethod
    def _validate_conditions(cls, conditions: List[Condition]):
        for cond in conditions:
            if cond.field not in cls.ALLOWED_FIELDS:
                raise ValidationError(f"Invalid field in condition: {cond.field}")
            if cond.operator not in cls.ALLOWED_OPERATORS:
                raise ValidationError(f"Invalid operator in condition: {cond.operator}")
            if not cond.value and cond.operator not in {"in_list", "not_in"}: 
                # Allow empty if it's meant to match empty strings, but let's just warn or block
                if not isinstance(cond.value, str):
                     raise ValidationError("Condition value must be a string")

            if cond.operator == "matches":
                try:
                    re.compile(cond.value)
                except re.error as e:
                    raise ValidationError(f"Invalid regex syntax in condition for {cond.field}: {str(e)}")
            
            if cond.operator in {"in_list", "not_in"}:
                if not cond.value.strip():
                     raise ValidationError(f"Value for {cond.operator} cannot be empty.")
