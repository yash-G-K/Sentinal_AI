import re
from typing import Optional
from .base import BaseDetector, DetectionResult
from app.models.attack_log import AttackType, SeverityLevel

class BotDetector(BaseDetector):
    def __init__(self):
        # Known malicious or sweeping bot User-Agents
        self.bad_user_agents = [
            r"(?i)(nmap)",
            r"(?i)(sqlmap)",
            r"(?i)(dirbuster)",
            r"(?i)(nikto)",
            r"(?i)(python-requests)",
            r"(?i)(curl)",
            r"(?i)(wget)",
            r"(?i)(postmanruntime)",
            r"(?i)(burpsuite)"
        ]
        self.compiled_patterns = [re.compile(p) for p in self.bad_user_agents]

    def analyze(self, payload: str, headers: dict = None) -> DetectionResult:
        if not headers:
            return DetectionResult(detected=False)
            
        user_agent = headers.get("user-agent", "")
        if not user_agent:
            return DetectionResult(
                detected=True,
                attack_type=AttackType.BOT,
                severity=SeverityLevel.LOW,
                confidence=80.0,
                matched_pattern="Missing User-Agent",
                explanation="Request has no User-Agent header, typical of automated scripts.",
                payload_snippet="Missing User-Agent"
            )
            
        for pattern in self.compiled_patterns:
            match = pattern.search(user_agent)
            if match:
                return DetectionResult(
                    detected=True,
                    attack_type=AttackType.BOT,
                    severity=SeverityLevel.MEDIUM,
                    confidence=95.0,
                    matched_pattern=pattern.pattern,
                    explanation=f"Suspicious automated tool or bot detected in User-Agent: {user_agent}",
                    payload_snippet=user_agent
                )
        return DetectionResult(detected=False)
