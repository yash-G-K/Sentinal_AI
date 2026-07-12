"""
Phase 9 — Database index migration.
Adds indexes on high-frequency query columns to hit the <200ms / <500ms API targets.

Indexes added:
  requests.created_at     — time-series WHERE/GROUP BY
  requests.decision       — ratio queries (blocked vs allowed)
  requests.ip_address     — IP reputation lookups
  attack_logs.created_at  — attack timeline queries
  attack_logs.attack_type — category breakdown queries
  attack_logs.severity    — severity filter queries
  security_events.created_at — alert feed queries
  security_events.severity   — critical alert count

Run once: python app/migrations/add_indexes.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import text
from app.database.database import engine
from loguru import logger

INDEXES = [
    # requests table
    ("idx_requests_created_at",    "requests",       "created_at"),
    ("idx_requests_decision",      "requests",       "decision"),
    ("idx_requests_ip_address",    "requests",       "ip_address"),
    # attack_logs table
    ("idx_attack_logs_created_at", "attack_logs",    "created_at"),
    ("idx_attack_logs_type",       "attack_logs",    "attack_type"),
    ("idx_attack_logs_severity",   "attack_logs",    "severity"),
    # security_events table
    ("idx_sec_events_created_at",  "security_events", "created_at"),
    ("idx_sec_events_severity",    "security_events", "severity"),
]

def create_indexes():
    with engine.connect() as conn:
        for idx_name, table, column in INDEXES:
            try:
                sql = text(
                    f"CREATE INDEX {idx_name} ON {table} ({column})"
                )
                conn.execute(sql)
                conn.commit()
                logger.info(f"  ✓ Created index {idx_name} on {table}.{column}")
            except Exception as e:
                err = str(e)
                if "Duplicate" in err or "already exists" in err or "1061" in err:
                    logger.info(f"  · Index {idx_name} already exists — skipping")
                else:
                    logger.warning(f"  ✗ Failed to create {idx_name}: {err}")

if __name__ == "__main__":
    logger.info("Phase 9: Creating database indexes for performance...")
    create_indexes()
    logger.info("Done.")
