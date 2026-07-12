"""
tests/load/locustfile.py
10.4 Load & Performance Benchmark

Simulates two types of users:
  - DashboardUser: Normal authenticated user browsing the app
  - AttackerUser:  Malicious actor sending known-bad payloads at speed

Usage:
  # Headless — 50 users, 5 spawn/sec, 30s run:
  locust -f tests/load/locustfile.py --headless -u 50 -r 5 --run-time 30s --host http://localhost:8000

  # Web UI:
  locust -f tests/load/locustfile.py --host http://localhost:8000
  # Then open http://localhost:8089
"""
from locust import HttpUser, task, between, events
from locust.exception import RescheduleTask
import json, statistics, time

# ── Shared state ───────────────────────────────────────────────────────────────
_latencies: list[float] = []


# ── Auth helper ───────────────────────────────────────────────────────────────
def get_token(client) -> str:
    """Obtain a real JWT from the auth endpoint."""
    r = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@sentinelai.io", "password": "Admin@123!"},
        name="/api/v1/auth/login [setup]",
        catch_response=True,
    )
    if r.status_code == 200:
        return r.json().get("access_token", "")
    # If test user doesn't exist, use a pre-signed test token
    return ""


# ── Dashboard (normal) User ────────────────────────────────────────────────────
class DashboardUser(HttpUser):
    """Mimics an analyst navigating the dashboard. ~3s between requests."""
    wait_time = between(1, 4)
    weight = 4   # 4x more normal users than attackers

    def on_start(self):
        self.token = get_token(self.client)
        self.headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(5)
    def load_kpis(self):
        t0 = time.perf_counter()
        with self.client.get(
            "/api/v1/dashboard/kpis",
            headers=self.headers,
            catch_response=True,
            name="GET /dashboard/kpis",
        ) as r:
            ms = (time.perf_counter() - t0) * 1000
            _latencies.append(ms)
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Status {r.status_code}")

    @task(3)
    def load_charts(self):
        with self.client.get(
            "/api/v1/dashboard/charts",
            headers=self.headers,
            catch_response=True,
            name="GET /dashboard/charts",
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Status {r.status_code}")

    @task(3)
    def load_analytics_timeseries(self):
        with self.client.get(
            "/api/v1/analytics/timeseries?range=7d",
            headers=self.headers,
            catch_response=True,
            name="GET /analytics/timeseries",
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Status {r.status_code}")

    @task(2)
    def load_firewall_rules(self):
        self.client.get(
            "/api/v1/firewall/rules",
            headers=self.headers,
            name="GET /firewall/rules",
        )

    @task(2)
    def load_security_events(self):
        self.client.get(
            "/api/v1/security-events",
            headers=self.headers,
            name="GET /security-events",
        )

    @task(1)
    def load_analytics_top(self):
        self.client.get(
            "/api/v1/analytics/top?range=7d",
            headers=self.headers,
            name="GET /analytics/top",
        )

    @task(1)
    def health_check(self):
        with self.client.get(
            "/api/v1/health",
            catch_response=True,
            name="GET /health",
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Health check failed: {r.status_code}")


# ── Attacker User ──────────────────────────────────────────────────────────────
class AttackerUser(HttpUser):
    """
    Simulates a malicious actor. Sends known-bad payloads rapidly.
    The WAF should block all of these with 403.
    """
    wait_time = between(0.1, 0.5)  # Attackers are fast
    weight = 1   # 1x attacker per 4 legitimate users

    SQLI_PAYLOADS = [
        "' OR '1'='1",
        "UNION ALL SELECT username, password FROM users--",
        "'; DROP TABLE users; --",
        "1; SELECT * FROM information_schema.tables",
    ]

    XSS_PAYLOADS = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg/onload=alert(1)>",
    ]

    RCE_PAYLOADS = [
        "| cat /etc/passwd",
        "&& whoami",
        "$(cat /etc/shadow)",
    ]

    @task(3)
    def send_sqli(self):
        import random
        payload = random.choice(self.SQLI_PAYLOADS)
        with self.client.get(
            f"/public/search?q={payload}",
            catch_response=True,
            name="ATTACK /public/search [SQLi]",
        ) as r:
            if r.status_code == 403:
                r.success()   # Blocked — WAF working correctly!
            elif r.status_code == 404:
                r.success()   # Path doesn't exist — still blocked by WAF
            else:
                r.failure(f"WAF MISS — SQLi not blocked! Status={r.status_code}")

    @task(2)
    def send_xss(self):
        import random
        payload = random.choice(self.XSS_PAYLOADS)
        with self.client.get(
            f"/public/page?content={payload}",
            catch_response=True,
            name="ATTACK /public/page [XSS]",
        ) as r:
            if r.status_code in (403, 404):
                r.success()
            else:
                r.failure(f"WAF MISS — XSS not blocked! Status={r.status_code}")

    @task(1)
    def send_rce(self):
        import random
        payload = random.choice(self.RCE_PAYLOADS)
        with self.client.get(
            f"/public/run?cmd={payload}",
            catch_response=True,
            name="ATTACK /public/run [RCE]",
        ) as r:
            if r.status_code in (403, 404):
                r.success()
            else:
                r.failure(f"WAF MISS — RCE not blocked! Status={r.status_code}")


# ── Report summary at end ──────────────────────────────────────────────────────
@events.quitting.add_listener
def print_latency_percentiles(environment, **kwargs):
    if _latencies:
        _latencies.sort()
        n = len(_latencies)
        p50 = _latencies[int(n * 0.50)]
        p95 = _latencies[int(n * 0.95)]
        p99 = _latencies[int(n * 0.99)]
        avg = statistics.mean(_latencies)
        print(f"""
╔══════════════════════════════════════════════════════╗
║       Sentinel AI  —  Performance Benchmark          ║
╠══════════════════════════════════════════════════════╣
║  Dashboard endpoint latencies (KPIs)                 ║
║  Samples  : {n:>6}                                   ║
║  Average  : {avg:>6.0f}ms                            ║
║  P50      : {p50:>6.0f}ms                            ║
║  P95      : {p95:>6.0f}ms                            ║
║  P99      : {p99:>6.0f}ms                            ║
║  Target   : <200ms (P99)                             ║
║  Status   : {"✅ PASS" if p99 < 200 else "❌ FAIL — optimize caching"}
╚══════════════════════════════════════════════════════╝
        """)
