import re
from typing import Optional
from .base import BaseDetector, DetectionResult
from app.models.attack_log import AttackType, SeverityLevel

class CommandInjectionDetector(BaseDetector):
    def __init__(self):
        self.patterns = [
            r"(?i)(;\s*(ls|cat|rm|echo|ping|nc|wget|curl)\b)",
            r"(?i)(\|\s*(ls|cat|rm|echo|ping|nc|wget|curl)\b)",
            r"(?i)(&\s*(ls|cat|rm|echo|ping|nc|wget|curl)\b)",
            r"(?i)(`.*?(ls|cat|rm|echo|ping|nc|wget|curl).*?`)",
            r"(?i)(\$\(.*?(ls|cat|rm|echo|ping|nc|wget|curl).*?\))",
            r"(?i)(/bin/(sh|bash|zsh))",
            r"(?i)(cmd\.exe\s*/c)"
        ]
        self.compiled_patterns = [re.compile(p) for p in self.patterns]

    def analyze(self, payload: str, headers: dict = None) -> DetectionResult:
        if not payload:
            return DetectionResult(detected=False)

        for pattern in self.compiled_patterns:
            match = pattern.search(payload)
            if match:
                return DetectionResult(
                    detected=True,
                    attack_type=AttackType.COMMAND_INJECTION,
                    severity=SeverityLevel.CRITICAL,
                    confidence=92.5,
                    matched_pattern=pattern.pattern,
                    explanation="OS Command Injection keywords detected.",
                    payload_snippet=payload[match.start():match.start()+50]
                )
        return DetectionResult(detected=False)
