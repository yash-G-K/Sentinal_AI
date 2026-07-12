"""
app/api/endpoints/ws.py
WebSocket endpoints:
  ws://localhost:8000/api/v1/ws/dashboard  — live KPI + threat events
  ws://localhost:8000/api/v1/ws/threats    — live threat feed only
"""
import asyncio
import json
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from app.websocket.manager import ws_manager
from app.database.database import SessionLocal
from app.services.dashboard_service import get_kpis

router = APIRouter()


@router.websocket("/dashboard")
async def ws_dashboard(ws: WebSocket):
    """Main dashboard real-time channel."""
    await ws_manager.connect(ws, "dashboard")
    try:
        # Send initial KPI snapshot immediately on connect
        try:
            db = SessionLocal()
            kpis = get_kpis(db)
            db.close()
            await ws_manager.send_personal(ws, {
                "type": "kpi_update",
                "data": {**kpis, "timestamp": datetime.utcnow().isoformat()},
            })
        except Exception as e:
            logger.warning(f"WS initial KPI push failed: {e}")

        # Keep connection alive — listen for ping/control messages
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=30)
                data = json.loads(msg)
                if data.get("type") == "ping":
                    await ws_manager.send_personal(ws, {"type": "pong", "ts": datetime.utcnow().isoformat()})
            except asyncio.TimeoutError:
                # Send heartbeat to keep TCP alive
                await ws_manager.send_personal(ws, {"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, "dashboard")
    except Exception as e:
        logger.warning(f"WS dashboard error: {e}")
        ws_manager.disconnect(ws, "dashboard")


@router.websocket("/threats")
async def ws_threats(ws: WebSocket):
    """Dedicated threat feed channel."""
    await ws_manager.connect(ws, "threats")
    try:
        await ws_manager.send_personal(ws, {
            "type": "connected",
            "message": "Sentinel-AI threat feed connected.",
            "ts": datetime.utcnow().isoformat(),
        })
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await ws_manager.send_personal(ws, {"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, "threats")
    except Exception as e:
        logger.warning(f"WS threats error: {e}")
        ws_manager.disconnect(ws, "threats")
