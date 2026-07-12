"""
tests/test_cache_service.py
10.1 Unit Tests — CacheService (pytest-asyncio style)

Covers:
- set / get / delete (basic)
- TTL expiry
- delete_prefix
- get_or_set with sync factory
- get_or_set with async factory
- cache hit on second call (doesn't re-run factory)
- status() response structure
- Redis fallback graceful degradation
"""
import time
import pytest
import pytest_asyncio
from app.services.cache_service import CacheService, TTL


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def cache():
    """A brand-new CacheService instance (memory backend, no shared state)."""
    svc = CacheService()
    await svc.init(redis_url=None)
    return svc


# ── 10.1.1  Basic set / get ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cache_set_and_get(cache):
    await cache.set("test:key", {"value": 42}, ttl=60)
    result = await cache.get("test:key")
    assert result == {"value": 42}


@pytest.mark.asyncio
async def test_cache_miss_returns_none(cache):
    result = await cache.get("nonexistent:key")
    assert result is None


@pytest.mark.asyncio
async def test_cache_delete(cache):
    await cache.set("test:del", "to_be_deleted", ttl=60)
    await cache.delete("test:del")
    assert await cache.get("test:del") is None


# ── 10.1.2  TTL expiry ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cache_ttl_expiry(cache):
    """Values with TTL=1 should expire after ~1 second."""
    await cache.set("test:ttl", "ephemeral", ttl=1)
    # Immediately available
    assert await cache.get("test:ttl") == "ephemeral"
    time.sleep(1.1)
    # Should have expired
    assert await cache.get("test:ttl") is None


# ── 10.1.3  delete_prefix ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cache_delete_prefix(cache):
    await cache.set("dashboard:kpis", {"v": 1}, ttl=60)
    await cache.set("dashboard:charts", {"v": 2}, ttl=60)
    await cache.set("settings:main", {"v": 3}, ttl=60)

    deleted = await cache.delete_prefix("dashboard:")
    assert deleted == 2
    assert await cache.get("dashboard:kpis") is None
    assert await cache.get("dashboard:charts") is None
    # settings: key must survive
    assert await cache.get("settings:main") == {"v": 3}


# ── 10.1.4  get_or_set (sync factory) ────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_or_set_sync_miss_then_hit(cache):
    call_count = {"n": 0}

    def factory():
        call_count["n"] += 1
        return {"computed": True}

    # First call: cache miss → factory runs
    v1 = await cache.get_or_set("test:gos", factory, ttl=60)
    assert v1 == {"computed": True}
    assert call_count["n"] == 1

    # Second call: cache hit → factory NOT called again
    v2 = await cache.get_or_set("test:gos", factory, ttl=60)
    assert v2 == {"computed": True}
    assert call_count["n"] == 1  # still 1


# ── 10.1.5  get_or_set (async factory) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_get_or_set_async_factory(cache):
    call_count = {"n": 0}

    async def async_factory():
        call_count["n"] += 1
        return {"async": True}

    v1 = await cache.get_or_set("test:async", async_factory, ttl=60)
    assert v1 == {"async": True}
    assert call_count["n"] == 1

    # Hit — async factory not called again
    v2 = await cache.get_or_set("test:async", async_factory, ttl=60)
    assert v2 == {"async": True}
    assert call_count["n"] == 1


# ── 10.1.6  status() structure ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cache_status_structure(cache):
    status = cache.status()
    assert "backend" in status
    assert status["backend"] == "memory"
    assert "total" in status
    assert "live" in status
    assert "expired" in status


# ── 10.1.7  Redis URL fallback ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_redis_fallback_to_memory():
    """Passing an unreachable Redis URL should degrade silently to memory."""
    svc = CacheService()
    await svc.init(redis_url="redis://127.0.0.1:19999/0")
    assert svc.status()["backend"] == "memory"

    # Should still be functional after fallback
    await svc.set("fallback:test", "ok", ttl=30)
    assert await svc.get("fallback:test") == "ok"


# ── 10.1.8  TTL constants sanity ─────────────────────────────────────────────

def test_ttl_constants_are_sane():
    assert TTL["kpis"] == 30
    assert TTL["charts"] == 300
    assert TTL["settings"] > 3600       # should be long (1 day)
    assert TTL["firewall_rules"] > 3600 # should be long (1 day)
    assert TTL["ip_reputation"] == 60
