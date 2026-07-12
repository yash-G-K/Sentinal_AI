"""
app/services/settings_service.py
Key-value settings backed by the system_settings table.
Provides typed getters/setters with defaults for every WAF knob.
"""
from typing import Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.system_setting import SystemSetting

# ── Default settings schema ────────────────────────────────────────────────────
DEFAULTS: dict[str, Any] = {
    # WAF Engine
    "waf_mode":                   "active",          # active | monitor | off
    "auto_block_enabled":         "true",
    "ai_analysis_enabled":        "true",
    "geo_blocking_enabled":       "true",
    "rate_limiting_enabled":      "true",

    # Thresholds
    "confidence_threshold":       "85",              # 0–100 (AI block threshold)
    "rate_limit_req_per_min":     "100",             # requests/IP/min
    "block_duration_minutes":     "30",              # temp-block duration
    "max_body_size_kb":           "512",             # max request body size

    # Attack detection toggles
    "detect_sqli":                "true",
    "detect_xss":                 "true",
    "detect_path_traversal":      "true",
    "detect_rce":                 "true",
    "detect_bot":                 "true",

    # Notifications
    "notify_email_enabled":       "false",
    "notify_slack_enabled":       "false",
    "notify_email_recipient":     "",
    "notify_slack_webhook":       "",
    "notify_on_critical":         "true",
    "notify_on_high":             "true",
    "notify_on_medium":           "false",

    # Logging
    "log_allowed_requests":       "false",
    "log_retention_days":         "90",

    # System
    "system_name":                "Sentinel-AI WAF",
    "system_timezone":            "UTC",
}


class SettingsService:

    def _get_or_default(self, db: Session, key: str) -> str:
        row = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
        if row:
            return row.setting_value
        return str(DEFAULTS.get(key, ""))

    def get_all(self, db: Session) -> dict[str, str]:
        rows = {r.setting_key: r.setting_value for r in db.query(SystemSetting).all()}
        merged = {}
        for key, default in DEFAULTS.items():
            merged[key] = rows.get(key, str(default))
        return merged

    def get(self, db: Session, key: str) -> str:
        return self._get_or_default(db, key)

    def set(self, db: Session, key: str, value: str) -> SystemSetting:
        row = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
        if row:
            row.setting_value = value
            row.updated_at = datetime.utcnow()
        else:
            row = SystemSetting(
                setting_key=key,
                setting_value=value,
                description=f"Setting: {key}",
            )
            db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def bulk_set(self, db: Session, updates: dict[str, str]) -> dict[str, str]:
        for key, value in updates.items():
            if key in DEFAULTS:   # only allow known keys
                self.set(db, key, str(value))
        return self.get_all(db)

    def reset_to_defaults(self, db: Session) -> dict[str, str]:
        db.query(SystemSetting).delete()
        db.commit()
        return DEFAULTS.copy()


settings_service = SettingsService()
