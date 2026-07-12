from pydantic import BaseModel
from typing import Optional
from app.models.attack_log import AttackType, SeverityLevel

class DetectionResult(BaseModel):
    detected: bool
    attack_type: Optional[AttackType] = None
    severity: Optional[SeverityLevel] = None
    confidence: float = 0.0
    matched_pattern: Optional[str] = None
    explanation: Optional[str] = None
    payload_snippet: Optional[str] = None

class BaseDetector:
    def analyze(self, payload: str, headers: dict = None) -> DetectionResult:
        raise NotImplementedError("Detectors must implement the analyze method.")
