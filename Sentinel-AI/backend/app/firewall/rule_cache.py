import threading
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.firewall_rule import FirewallRule
from datetime import datetime, timedelta
from loguru import logger

CACHE_TTL_SECONDS = 60  # Refresh cache every 60 seconds


class RuleCache:
    """
    In-memory cache for Active Firewall Rules.
    This prevents hitting the database for every single HTTP request.
    Auto-refreshes every 60 seconds and filters expired rules on access.
    """
    def __init__(self):
        self._rules: List[FirewallRule] = []
        self._lock = threading.RLock()
        self._last_refresh: Optional[datetime] = None

    def refresh(self, db: Optional[Session] = None):
        """Loads all Active rules from the database into memory, ordered by priority."""
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True

        try:
            with self._lock:
                # Load rules that are Enabled, Active, and not expired
                rules = db.query(FirewallRule).filter(
                    FirewallRule.enabled == True,
                    FirewallRule.status == "Active",
                    (FirewallRule.expires_at == None) | (FirewallRule.expires_at > datetime.utcnow())
                ).order_by(FirewallRule.priority.desc()).all()

                from sqlalchemy.orm import make_transient
                for r in rules:
                    make_transient(r)

                self._rules = rules
                self._last_refresh = datetime.utcnow()
                logger.info(f"RuleCache refreshed. Loaded {len(self._rules)} active rules.")
        finally:
            if close_db:
                db.close()

    def get_active_rules(self) -> List[FirewallRule]:
        """Returns the cached rules, auto-refreshing if TTL expired."""
        now = datetime.utcnow()

        # Auto-refresh if cache is stale
        if self._last_refresh is None or (now - self._last_refresh).total_seconds() > CACHE_TTL_SECONDS:
            self.refresh()

        with self._lock:
            # Filter out expired rules even if they slipped in (e.g., temp blocks)
            active = [r for r in self._rules if r.expires_at is None or r.expires_at > now]
            return active

rule_cache = RuleCache()
