import re
from typing import Optional
from .base import BaseDetector, DetectionResult
from app.models.attack_log import AttackType, SeverityLevel

class SQLInjectionDetector(BaseDetector):
    def __init__(self):
        # Enhanced SQLi regex patterns
        self.patterns = [
            r"(?i)(UNION\s+(?:ALL\s+)?SELECT)",
            r"(?i)(SELECT\s+.*?\s+FROM)",
            r"(?i)(INSERT\s+INTO\s+.*?\s+VALUES)",
            r"(?i)(UPDATE\s+.*?\s+SET)",
            r"(?i)(DELETE\s+FROM)",
            r"(?i)(DROP\s+TABLE)",
            r"(?i)(OR\s+[\w\'\"]+\s*=\s*[\w\'\"]+)", # Matches OR 1=1, OR '1'='1', OR "x"="x"
            r"(?i)('[\s]*=[\s]*'|\"[\s]*=[\s]*\")",
            r"(?i)(--\s*$|--\s+.*$|#\s*$)",
            r"(?i)(;\s*EXEC(\s|\+)+(s|x)p\w+)"
        ]
        self.compiled_patterns = [re.compile(p) for p in self.patterns]

    def analyze(self, payload: str, headers: dict = None) -> DetectionResult:
        if not payload:
            return DetectionResult(detected=False)

        for idx, pattern in enumerate(self.compiled_patterns):
            match = pattern.search(payload)
            if match:
                matched_str = match.group(0)
                # If we hit an obvious boolean based or UNION based SQLi, it's CRITICAL
                severity = SeverityLevel.CRITICAL if idx < 7 else SeverityLevel.HIGH
                return DetectionResult(
                    detected=True,
                    attack_type=AttackType.SQLI,
                    severity=severity,
                    confidence=95.0,
                    matched_pattern=pattern.pattern,
                    explanation="SQL Injection syntax detected in payload.",
                    payload_snippet=payload[match.start():match.start()+50]
                )
        return DetectionResult(detected=False)
