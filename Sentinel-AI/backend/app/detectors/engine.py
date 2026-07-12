from typing import List, Optional, Set
import json
from .base import DetectionResult
from .sqli import SQLInjectionDetector
from .xss import XSSDetector
from .command_injection import CommandInjectionDetector
from .directory_traversal import DirectoryTraversalDetector
from .bot import BotDetector


class DetectionEngine:
    # Maps rule_type (DB) → detector instance
    DETECTOR_MAP = {
        'BUILTIN_SQLI':           None,  # filled in __init__
        'BUILTIN_XSS':            None,
        'BUILTIN_RCE':            None,
        'BUILTIN_PATH_TRAVERSAL': None,
        'BUILTIN_BOT':            None,
    }

    def __init__(self):
        self.DETECTOR_MAP = {
            'BUILTIN_SQLI':           SQLInjectionDetector(),
            'BUILTIN_XSS':            XSSDetector(),
            'BUILTIN_RCE':            CommandInjectionDetector(),
            'BUILTIN_PATH_TRAVERSAL': DirectoryTraversalDetector(),
            'BUILTIN_BOT':            BotDetector(),
        }
        # Cache of which rule_types are enabled; refreshed from DB on each request
        # via get_enabled_types(). Falls back to all-enabled if DB is unavailable.
        self._enabled_types: Optional[Set[str]] = None

    def _load_enabled_types(self) -> Set[str]:
        """Queries the DB for which BUILTIN_* rules are currently enabled."""
        try:
            from app.database.database import SessionLocal
            from app.models.firewall_rule import FirewallRule
            db = SessionLocal()
            try:
                rows = (
                    db.query(FirewallRule.rule_type, FirewallRule.enabled)
                    .filter(FirewallRule.rule_type.in_(list(self.DETECTOR_MAP.keys())))
                    .all()
                )
                enabled = {rt for rt, en in rows if en}
                return enabled
            finally:
                db.close()
        except Exception:
            # If DB is unreachable, default to all detectors enabled
            return set(self.DETECTOR_MAP.keys())

    def refresh_enabled_types(self):
        """Called by the rule cache when rules are updated."""
        self._enabled_types = self._load_enabled_types()

    def analyze_request(
        self,
        method: str,
        full_url: str,
        headers: dict,
        query_params: dict,
        body: str,
    ) -> Optional[DetectionResult]:
        """
        Combines all request components into a single payload string and evaluates
        them through the enabled heuristic detectors.
        Returns the highest severity detection, or None if SAFE.
        """
        # Refresh enabled types from DB each request so toggle changes take effect immediately
        enabled_types = self._load_enabled_types()

        # Build combined payload
        payload_parts = [full_url, body]
        if query_params:
            payload_parts.append(json.dumps(query_params))
        combined_payload = " \n ".join([p for p in payload_parts if p])

        detections: List[DetectionResult] = []

        for rule_type, detector in self.DETECTOR_MAP.items():
            if rule_type not in enabled_types:
                continue  # Rule is disabled in the UI — skip this detector
            result = detector.analyze(combined_payload, headers=headers)
            if result.detected:
                detections.append(result)

        if not detections:
            return None  # SAFE

        # Priority resolution: Return the most severe detection.
        severity_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
        detections.sort(key=lambda x: severity_rank.get(x.severity.value, 0), reverse=True)
        return detections[0]


engine = DetectionEngine()
