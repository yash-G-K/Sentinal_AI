"""
app/websocket/broadcaster.py
Background task that periodically pushes KPI snapshots and live threat
events to all connected WebSocket clients.
"""
import asyncio
from datetime import datetime
from loguru import logger

from app.websocket.manager import ws_manager
from app.database.database import SessionLocal
from app.services.dashboard_service import get_kpis


class RealtimeBroadcaster:
    """
    Runs as a background asyncio task.
    Every KPI_INTERVAL seconds it queries the DB and pushes a kpi_update.
    """
    KPI_INTERVAL = 15   # seconds between KPI pushes

    async def run(self) -> None:
        logger.info("RealtimeBroadcaster started.")
        while True:
            await asyncio.sleep(self.KPI_INTERVAL)
            try:
                db = SessionLocal()
                kpis = get_kpis(db)
                db.close()
                await ws_manager.emit_kpi_update({
                    **kpis,
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except Exception as e:
                logger.warning(f"Broadcaster KPI push failed: {e}")


broadcaster = RealtimeBroadcaster()
