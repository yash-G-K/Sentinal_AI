import re
from typing import Optional
from .base import BaseDetector, DetectionResult
from app.models.attack_log import AttackType, SeverityLevel

class XSSDetector(BaseDetector):
    def __init__(self):
        self.patterns = [
            r"(?i)(<script>.*?</script>)",
            r"(?i)(<.*?javascript:.*?>)",
            r"(?i)(<.*?on\w+\s*=.*?>)",
            r"(?i)(document\.(cookie|location|write))",
            r"(?i)(alert\s*\()",
            r"(?i)(window\.(location|open))",
            r"(?i)(eval\s*\()",
            r"(?i)(<iframe.*?src=.*?>)"
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
                    attack_type=AttackType.XSS,
                    severity=SeverityLevel.HIGH,
                    confidence=90.0,
                    matched_pattern=pattern.pattern,
                    explanation="Cross-Site Scripting (XSS) payload detected.",
                    payload_snippet=payload[match.start():match.start()+50]
                )
        return DetectionResult(detected=False)
