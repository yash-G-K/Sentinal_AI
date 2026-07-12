from fastapi import FastAPI
from contextlib import asynccontextmanager
from loguru import logger
import asyncio

from app.config.settings import settings
from app.logs.logger import setup_logging
from app.core.exceptions import setup_exception_handlers
from app.middleware.cors import setup_cors
from app.middleware.request_logger import setup_request_logger
from app.api import health
from app.api.router import api_router
from app.api.endpoints.ws import router as ws_router
from app.database.database import test_connection
from app.services.threat_agent import threat_agent
from app.services.cache_service import cache
from app.websocket.broadcaster import broadcaster
from apscheduler.schedulers.asyncio import AsyncIOScheduler


async def _vacuum_old_requests():
    """Daily background job: delete requests older than the retention window."""
    from app.database.database import SessionLocal
    from sqlalchemy import text
    from datetime import datetime, timedelta

    # Read retention from settings (cache hit avoids extra DB query)
    settings_data = await cache.get("settings:all") or {}
    retention_days = int(settings_data.get("data_retention_days", 90))
    cutoff = datetime.utcnow() - timedelta(days=retention_days)

    db = SessionLocal()
    try:
        result = db.execute(
            text("DELETE FROM requests WHERE created_at < :cutoff LIMIT 10000"),
            {"cutoff": cutoff}
        )
        db.commit()
        deleted = result.rowcount
        if deleted:
            logger.info(f"Vacuum: deleted {deleted} requests older than {retention_days} days.")
            await cache.delete("dashboard:kpis")   # refresh KPIs after vacuum
    except Exception as e:
        logger.warning(f"Vacuum failed (non-fatal): {e}")
        db.rollback()
    finally:
        db.close()


def _health_check_all_domains():
    """Background job: ping every enabled protected domain and update status."""
    from app.database.database import SessionLocal
    from app.models.protected_domain import ProtectedDomain
    from app.api.endpoints.domains import _run_health_check
    db = SessionLocal()
    try:
        domains = db.query(ProtectedDomain).filter(
            ProtectedDomain.deleted_at == None,
            ProtectedDomain.enabled == True,
        ).all()
        for domain in domains:
            try:
                _run_health_check(domain, db)
            except Exception as e:
                logger.warning(f"Health check failed for {domain.host}: {e}")
        if domains:
            logger.debug(f"Health checks completed for {len(domains)} domain(s).")
    except Exception as e:
        logger.warning(f"Domain health check job error (non-fatal): {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Application startup
    setup_logging()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # Test DB Connection
    logger.info("Initializing database connections...")
    test_connection()

    # Initialize cache (Redis if REDIS_URL is set, else in-memory fallback)
    await cache.init(redis_url=settings.REDIS_URL)
    logger.info(f"Cache initialized: backend={cache.status()['backend']}")

    # Initialize and start APScheduler for background jobs
    scheduler = AsyncIOScheduler()
    scheduler.add_job(threat_agent.run_evaluation, 'interval', minutes=60)
    scheduler.add_job(_vacuum_old_requests, 'cron', hour=3, minute=0)  # daily 3 AM
    scheduler.add_job(_health_check_all_domains, 'interval', minutes=5)  # domain health checks every 5 min
    scheduler.start()
    logger.info("Background jobs scheduled (threat-agent 60min, vacuum 03:00, domain-health 5min).")


    # Start WebSocket real-time broadcaster
    broadcaster_task = None
    try:
        broadcaster_task = asyncio.create_task(broadcaster.run())
        logger.info("WebSocket real-time broadcaster started.")
    except Exception as e:
        logger.warning(f"WebSocket broadcaster failed to start (non-fatal): {e}")


    # Seed demo Super Admin account (idempotent)
    try:
        from app.database.database import SessionLocal
        from app.models.user import User
        from app.services.auth_service import auth_service
        _db = SessionLocal()
        try:
            DEMO_ADMIN_EMAIL = "admin@sentinel.ai"
            if not _db.query(User).filter(User.email == DEMO_ADMIN_EMAIL).first():
                auth_service.create_user(
                    _db,
                    email=DEMO_ADMIN_EMAIL,
                    full_name="Demo Super Admin",
                    password="Admin@1234",
                    role="Super Admin",
                )
                logger.info("Demo Super Admin seeded (admin@sentinel.ai / Admin@1234).")
            else:
                logger.info("Demo Super Admin already exists, skipping seed.")
        finally:
            _db.close()
    except Exception as e:
        logger.warning(f"Demo admin seeding failed (non-fatal): {e}")

    # Seed demo protected domains (DVWA + Juice Shop)
    try:
        from app.database.database import SessionLocal
        from app.models.protected_domain import ProtectedDomain
        from app.api.endpoints.domains import _run_health_check
        DEMO_DOMAINS = [
            {
                "name":            "DVWA",
                "host":            "localhost:4280",
                "origin_url":      "http://localhost:4280",
                "description":     "Damn Vulnerable Web Application — intentionally vulnerable PHP/MySQL app for security training.",
                "app_type":        "DVWA",
                "environment":     "Docker",
                "protection_mode": "block",
                "criticality":     "High",
                "internet_facing": False,
                "production":      False,
                "tags":            ["lab", "docker", "testing", "vulnerable"],
                "icon":            "🎯",
                "color":           "#dc2626",
            },
            {
                "name":            "OWASP Juice Shop",
                "host":            "localhost:3000",
                "origin_url":      "http://localhost:3000",
                "description":     "OWASP Juice Shop — modern insecure web application for security training.",
                "app_type":        "JuiceShop",
                "environment":     "Docker",
                "protection_mode": "block",
                "criticality":     "High",
                "internet_facing": False,
                "production":      False,
                "tags":            ["lab", "docker", "owasp", "juice-shop"],
                "icon":            "🧃",
                "color":           "#f97316",
            },
        ]
        _db = SessionLocal()
        try:
            seeded = 0
            for dd in DEMO_DOMAINS:
                exists = _db.query(ProtectedDomain).filter(
                    ProtectedDomain.host == dd["host"],
                    ProtectedDomain.deleted_at == None,
                ).first()
                if not exists:
                    domain = ProtectedDomain(**dd, status="unknown", risk="none", enabled=True)
                    _db.add(domain)
                    _db.commit()
                    _db.refresh(domain)
                    try:
                        _run_health_check(domain, _db)
                    except Exception:
                        pass
                    seeded += 1
            if seeded:
                logger.info(f"Seeded {seeded} demo protected domain(s) (DVWA + Juice Shop).")
            else:
                logger.info("Demo protected domains already exist, skipping seed.")
        finally:
            _db.close()
    except Exception as e:
        logger.warning(f"Demo domain seeding failed (non-fatal): {e}")

    # Warm up Ollama in background — don't block startup, model may take 30-60s to load
    if settings.AI_ENABLED:
        try:
            from app.ai.ollama_service import ollama_service
            async def _warmup_ollama():
                logger.info("[Ollama] Starting background model warm-up...")
                ok = await ollama_service.health_check()
                if ok:
                    logger.info(f"[Ollama] Model '{settings.OLLAMA_MODEL}' is ready.")
                else:
                    logger.warning(
                        f"[Ollama] Model '{settings.OLLAMA_MODEL}' not yet ready. "
                        "WAF will use rule-based detection until Ollama responds. "
                        f"Run: ollama run {settings.OLLAMA_MODEL} 'ping'  to pre-load it."
                    )
            asyncio.create_task(_warmup_ollama())
        except Exception as e:
            logger.warning(f"[Ollama] Warm-up task failed to start (non-fatal): {e}")

    yield

    # Application shutdown
    if broadcaster_task:
        broadcaster_task.cancel()
    scheduler.shutdown()
    logger.info(f"Shutting down {settings.APP_NAME}")


def create_app() -> FastAPI:
    """Factory function to create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        lifespan=lifespan
    )

    # Configure Middleware
    setup_cors(app)
    setup_request_logger(app)

    # Configure Exception Handlers
    setup_exception_handlers(app)

    # Register REST Routers
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(api_router, prefix="/api/v1")

    # Register WebSocket Router
    app.include_router(ws_router, prefix="/api/v1/ws")

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
