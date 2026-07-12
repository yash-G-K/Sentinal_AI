"""
app/websocket/manager.py
Manages all active WebSocket connections and broadcasts real-time events.
"""
import asyncio
import json
from typing import Optional
from fastapi import WebSocket
from loguru import logger


class ConnectionManager:
    """Thread-safe WebSocket connection pool with typed broadcast channels."""

    def __init__(self):
        # channel → list of connected WebSockets
        self._channels: dict[str, list[WebSocket]] = {
            "dashboard": [],
            "threats":   [],
            "all":       [],
        }

    # ── Connection lifecycle ────────────────────────────────────────────────────

    async def connect(self, ws: WebSocket, channel: str = "all") -> None:
        await ws.accept()
        self._channels.setdefault(channel, []).append(ws)
        self._channels["all"].append(ws)
        logger.info(f"WS connect: channel={channel}  total={self._total()}")

    def disconnect(self, ws: WebSocket, channel: str = "all") -> None:
        for sockets in self._channels.values():
            if ws in sockets:
                sockets.remove(ws)
        logger.info(f"WS disconnect: channel={channel}  total={self._total()}")

    def _total(self) -> int:
        return len(self._channels["all"])

    # ── Broadcast helpers ───────────────────────────────────────────────────────

    async def broadcast(self, payload: dict, channel: str = "all") -> None:
        """Broadcast JSON payload to all clients on a channel."""
        message = json.dumps(payload)
        dead: list[WebSocket] = []
        targets = list(self._channels.get(channel, []))
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, channel)

    async def send_personal(self, ws: WebSocket, payload: dict) -> None:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            pass

    # ── Typed event emitters (called from middleware/services) ─────────────────

    async def emit_threat(self, event: dict) -> None:
        """Emit a new attack/threat event to dashboard + threats channels."""
        payload = {"type": "threat", "data": event}
        await self.broadcast(payload, "dashboard")
        await self.broadcast(payload, "threats")

    async def emit_kpi_update(self, kpis: dict) -> None:
        """Push KPI snapshot update to dashboard channel."""
        payload = {"type": "kpi_update", "data": kpis}
        await self.broadcast(payload, "dashboard")

    async def emit_request(self, event: dict) -> None:
        """Emit a new HTTP request event (for live request feed)."""
        payload = {"type": "request", "data": event}
        await self.broadcast(payload, "dashboard")

    async def emit_system(self, message: str, level: str = "info") -> None:
        """Emit a system-level notification."""
        payload = {"type": "system", "level": level, "message": message}
        await self.broadcast(payload, "all")


# Global singleton
ws_manager = ConnectionManager()
