import os
from sqlalchemy import create_engine, text, URL, event
from sqlalchemy.orm import sessionmaker
from loguru import logger
from app.config.settings import settings

# Construct the URL safely to automatically encode special characters
DATABASE_URL = URL.create(
    drivername="mysql+pymysql",
    username=settings.DB_USER,
    password=settings.DB_PASSWORD,
    host=settings.DB_HOST,
    port=settings.DB_PORT,
    database=settings.DB_NAME
)

# ── Phase 9: Optimized Connection Pool ────────────────────────────────────────
# min 5 connections ready, burst to 20, overflow 10, recycle every hour
engine = create_engine(
    DATABASE_URL,
    pool_size=5,          # minimum persistent connections
    max_overflow=15,      # additional connections under load (5+15=20 max)
    pool_recycle=1800,    # recycle connections every 30 min (avoid MySQL 8h timeout)
    pool_timeout=10,      # wait up to 10s for a connection before raising
    pool_pre_ping=True,   # validate connections before use (catches stale ones)
    echo=False,
    future=True,
    # Optimize per-query performance
    connect_args={
        "charset": "utf8mb4",
        "connect_timeout": 10,
        "read_timeout": 30,
        "write_timeout": 30,
    }
)

# ── Session factory ────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,  # Avoid lazy-load issues after commit
)


def get_db():
    """Dependency for FastAPI to inject SQLAlchemy database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection():
    """Test the database connection on startup."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info(f"Database connection established (pool_size=5, max_overflow=15).")
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        raise e
