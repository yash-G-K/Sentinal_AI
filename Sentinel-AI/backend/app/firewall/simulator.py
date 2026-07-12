from typing import Dict, Any, Tuple, Optional
from app.schemas.firewall import SimulationRequest, Condition
from app.firewall.firewall_engine import firewall_engine
from app.models.firewall_rule import FirewallRule

class RuleSimulator:
    """
    Simulates a firewall rule against a provided HTTP request payload.
    Used by the frontend to test rules before enabling them.
    """
    
    @classmethod
    def simulate(cls, req: SimulationRequest) -> Tuple[bool, str, Optional[Condition], str]:
        """
        Returns (would_match, action_taken, matched_condition, explanation)
        """
        request_data = {
            "method": req.method,
            "path": req.path,
            "headers": req.headers,
            "query_params": req.query_params,
            "body": req.body,
            "user_agent": req.user_agent,
            "country": req.country
        }

        # If no conditions, it's a legacy rule matching by IP target only (handled elsewhere normally)
        if not req.rule.conditions:
            if req.rule.target == "*" or req.rule.target == req.ip_address:
                return True, req.rule.action.value, None, "Matched via legacy target IP matching."
            return False, "ALLOW", None, f"Target IP {req.rule.target} did not match {req.ip_address}."
            
        # Check conditions
        for cond in req.rule.conditions:
            cond_dict = cond.model_dump()
            matched = firewall_engine._evaluate_condition(cond_dict, request_data, req.ip_address)
            
            if not matched:
                return False, "ALLOW", None, f"Simulation failed at condition: {cond.field} {cond.operator} '{cond.value}'"
                
        # If all matched
        return True, req.rule.action.value, req.rule.conditions[-1], "All conditions matched successfully. Rule would trigger."
