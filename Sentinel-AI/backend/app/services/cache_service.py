"""
app/services/cache_service.py
Phase 9 — Caching layer.

Architecture:
  1. Primary: Redis (if REDIS_URL is set and Redis responds)
  2. Fallback: In-memory LRU cache with TTL (zero-dependency, always available)

Usage:
    from app.services.cache_service import cache

    # Store
    await cache.set("key", value, ttl=30)

    # Fetch (returns None on miss)
    value = await cache.get("key")

    # Delete
    await cache.delete("key")

    # Delete by prefix (e.g., invalidate all settings keys)
    await cache.delete_prefix("settings:")
"""
import asyncio
import json
import time
import threading
from typing import Any, Optional
from loguru import logger

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False


# ── TTL keys per domain ────────────────────────────────────────────────────────
TTL = {
    "kpis":           30,        # Dashboard KPIs — 30 seconds
    "charts":         300,       # Traffic / attack timeline — 5 minutes
    "analytics":      300,       # Analytics timeseries — 5 minutes
    "top":            300,       # Top endpoints / countries — 5 minutes
    "settings":       86_400,    # Settings — 1 day (invalidated on PUT)
    "firewall_rules": 86_400,    # Firewall rules (invalidated on mutation)
    "ip_reputation":  60,        # Per-IP reputation score — 60 seconds
    "default":        120,       # Generic 2-minute fallback
}


# ── In-memory fallback store ───────────────────────────────────────────────────
class _MemoryStore:
    """Thread-safe in-memory TTL cache."""

    def __init__(self):
        self._data: dict[str, tuple[Any, float]] = {}   # key → (value, expires_at)
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            value, exp = entry
            if time.monotonic() > exp:
                del self._data[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            self._data[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    def delete_prefix(self, prefix: str) -> int:
        with self._lock:
            keys = [k for k in self._data if k.startswith(prefix)]
            for k in keys:
                del self._data[k]
            return len(keys)

    def size(self) -> int:
        return len(self._data)

    def stats(self) -> dict:
        now = time.monotonic()
        live = sum(1 for _, (_, exp) in self._data.items() if now <= exp)
        return {"total": len(self._data), "live": live, "expired": len(self._data) - live}


_mem = _MemoryStore()


# ── Cache Service ──────────────────────────────────────────────────────────────
class CacheService:
    """
    Unified async cache service.
    Uses Redis when available; falls back to in-memory transparently.
    """

    def __init__(self):
        self._redis: Optional[Any] = None
        self._using_redis = False
        self._redis_url: Optional[str] = None

    async def init(self, redis_url: Optional[str] = None) -> None:
        """Call once at application startup."""
        if not _REDIS_AVAILABLE or not redis_url:
            logger.info("Cache: using in-memory store (Redis not configured).")
            return

        try:
            r = aioredis.from_url(redis_url, socket_connect_timeout=2, decode_responses=True)
            await r.ping()
            self._redis = r
            self._using_redis = True
            self._redis_url = redis_url
            logger.info(f"Cache: connected to Redis at {redis_url}")
        except Exception as e:
            logger.warning(f"Cache: Redis unavailable ({e}) — falling back to in-memory store.")

    # ── Core operations ──────────────────────────────────────────────────────

    async def get(self, key: str) -> Optional[Any]:
        if self._using_redis:
            try:
                raw = await self._redis.get(key)
                if raw is None:
                    return None
                return json.loads(raw)
            except Exception as e:
                logger.debug(f"Cache Redis get error ({key}): {e}")
                self._using_redis = False   # degrade gracefully
        # Memory fallback
        return _mem.get(key)

    async def set(self, key: str, value: Any, ttl: int = TTL["default"]) -> None:
        serialized = json.dumps(value, default=str)
        if self._using_redis:
            try:
                await self._redis.setex(key, ttl, serialized)
                return
            except Exception as e:
                logger.debug(f"Cache Redis set error ({key}): {e}")
                self._using_redis = False
        # Memory fallback
        _mem.set(key, value, ttl)

    async def delete(self, key: str) -> None:
        if self._using_redis:
            try:
                await self._redis.delete(key)
            except Exception:
                pass
        _mem.delete(key)

    async def delete_prefix(self, prefix: str) -> int:
        count = 0
        if self._using_redis:
            try:
                keys = await self._redis.keys(f"{prefix}*")
                if keys:
                    await self._redis.delete(*keys)
                    count = len(keys)
                return count
            except Exception:
                pass
        return _mem.delete_prefix(prefix)

    # ── Convenience: get-or-set ──────────────────────────────────────────────

    async def get_or_set(self, key: str, factory, ttl: int = TTL["default"]) -> Any:
        """
        Try cache first. On miss, call factory() (sync or async),
        store the result, and return it.
        """
        cached = await self.get(key)
        if cached is not None:
            return cached

        if asyncio.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = await asyncio.to_thread(factory)

        await self.set(key, value, ttl)
        return value

    # ── Status ───────────────────────────────────────────────────────────────

    def status(self) -> dict:
        backend = "redis" if self._using_redis else "memory"
        stats   = {} if self._using_redis else _mem.stats()
        return {"backend": backend, "redis_url": self._redis_url, **stats}


# ── Singleton ─────────────────────────────────────────────────────────────────
cache = CacheService()
