import re
from typing import Optional
from .base import BaseDetector, DetectionResult
from app.models.attack_log import AttackType, SeverityLevel

class DirectoryTraversalDetector(BaseDetector):
    def __init__(self):
        self.patterns = [
            r"(\.\./\.\./)",
            r"(\.\.\\\.\.\\)",
            r"(%2e%2e%2f)",
            r"(%252e%252e%252f)",
            r"(etc/passwd)",
            r"(boot\.ini)",
            r"(windows\\system32)"
        ]
        self.compiled_patterns = [re.compile(p, re.IGNORECASE) for p in self.patterns]

    def analyze(self, payload: str, headers: dict = None) -> DetectionResult:
        if not payload:
            return DetectionResult(detected=False)

        for pattern in self.compiled_patterns:
            match = pattern.search(payload)
            if match:
                return DetectionResult(
                    detected=True,
                    attack_type=AttackType.PATH_TRAVERSAL,
                    severity=SeverityLevel.HIGH,
                    confidence=95.0,
                    matched_pattern=pattern.pattern,
                    explanation="Path/Directory Traversal attempt detected.",
                    payload_snippet=payload[match.start():match.start()+50]
                )
        return DetectionResult(detected=False)
