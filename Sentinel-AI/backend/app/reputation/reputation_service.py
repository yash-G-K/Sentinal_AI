from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from app.models.ip_reputation import IPReputation, ReputationStatus
from app.models.attack_log import AttackType, SeverityLevel
from app.models.blocked_ip import BlockedIP, BlockStatus
from loguru import logger

class ReputationService:
    def __init__(self):
        # Configuration thresholds
        self.MAX_SCORE = 100.0
        self.MIN_SCORE = 0.0
        
        self.SAFE_THRESHOLD = 70.0
        self.BLOCK_THRESHOLD = 30.0
        
        self.LEGITIMATE_INCREMENT = 0.5
        
        self.SEVERITY_PENALTY = {
            SeverityLevel.LOW: 5.0,
            SeverityLevel.MEDIUM: 15.0,
            SeverityLevel.HIGH: 25.0,
            SeverityLevel.CRITICAL: 40.0
        }

    def evaluate_request(
        self, 
        db: Session, 
        ip_address: str, 
        attack_type: Optional[AttackType] = None, 
        severity: Optional[SeverityLevel] = None
    ) -> ReputationStatus:
        """
        Updates the reputation score for an IP based on the request's threat level.
        Returns the resulting ReputationStatus (SAFE, SUSPICIOUS, BLOCKED).
        """
        # Ensure IP exists
        ip_rep = db.query(IPReputation).filter(IPReputation.ip_address == ip_address).first()
        if not ip_rep:
            ip_rep = IPReputation(ip_address=ip_address, reputation_score=self.MAX_SCORE)
            db.add(ip_rep)
            db.flush()

        ip_rep.total_requests += 1

        if attack_type and severity:
            # Malicious request
            ip_rep.malicious_requests += 1
            
            # Update specific counters
            if attack_type == AttackType.SQLI:
                ip_rep.sqli_count += 1
            elif attack_type == AttackType.XSS:
                ip_rep.xss_count += 1
            elif attack_type == AttackType.COMMAND_INJECTION:
                ip_rep.command_count += 1
            elif attack_type == AttackType.PATH_TRAVERSAL:
                ip_rep.traversal_count += 1
            elif attack_type == AttackType.BOT:
                ip_rep.bot_count += 1

            # Apply Penalty
            penalty = self.SEVERITY_PENALTY.get(severity, 5.0)
            ip_rep.reputation_score = max(self.MIN_SCORE, ip_rep.reputation_score - penalty)
        else:
            # Legitimate request, slowly heal reputation
            ip_rep.reputation_score = min(self.MAX_SCORE, ip_rep.reputation_score + self.LEGITIMATE_INCREMENT)

        # Determine Status
        previous_status = ip_rep.status
        
        if ip_rep.reputation_score <= self.BLOCK_THRESHOLD:
            ip_rep.status = ReputationStatus.BLOCKED
        elif ip_rep.reputation_score < self.SAFE_THRESHOLD:
            ip_rep.status = ReputationStatus.SUSPICIOUS
        else:
            ip_rep.status = ReputationStatus.SAFE

        # Automatically create BlockedIP entry if newly blocked
        if ip_rep.status == ReputationStatus.BLOCKED and previous_status != ReputationStatus.BLOCKED:
            ip_rep.blocked_requests += 1
            ip_rep.blocked_until = datetime.utcnow() + timedelta(hours=24) # Temporary 24h block
            
            blocked_entry = BlockedIP(
                ip_address=ip_address,
                expires_at=ip_rep.blocked_until,
                status=BlockStatus.BLOCKED
            )
            db.add(blocked_entry)
            logger.warning(f"IP {ip_address} automatically blocked due to poor reputation ({ip_rep.reputation_score}).")
            
        elif ip_rep.status == ReputationStatus.SAFE and previous_status == ReputationStatus.BLOCKED:
            # If it healed back to SAFE, unblock it
            ip_rep.blocked_until = None
            db.query(BlockedIP).filter(
                BlockedIP.ip_address == ip_address, 
                BlockedIP.status == BlockStatus.BLOCKED
            ).update({"status": BlockStatus.UNBLOCKED})
            logger.info(f"IP {ip_address} automatically unblocked as reputation healed.")

        db.flush()
        return ip_rep.status

reputation_service = ReputationService()
