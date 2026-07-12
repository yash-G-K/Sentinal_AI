"""
GeoIP enrichment service.

Uses the free ip-api.com JSON endpoint (no API key needed, 45 req/min on free tier).
Always fails silently — a GeoIP failure must NEVER block the WAF pipeline.
"""
import httpx
from loguru import logger


class GeoIPService:
    """Resolves an IP address to country and city using ip-api.com."""

    BASE_URL = "http://ip-api.com/json/{ip}?fields=status,country,countryCode,city"
    TIMEOUT = 1.5  # Hard cap — WAF latency budget is tight

    # IPs that should never be sent to an external lookup
    PRIVATE_PREFIXES = ("10.", "172.", "192.168.", "127.", "::1", "localhost")

    def _is_private(self, ip: str) -> bool:
        return any(ip.startswith(p) for p in self.PRIVATE_PREFIXES)

    async def lookup(self, ip: str) -> tuple[str | None, str | None]:
        """
        Returns (country_code, city) or (None, None) on any failure.
        Uses country *code* (e.g. 'US') not full name to match frontend expectations.
        """
        if self._is_private(ip):
            return ("Local", "Local")

        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                resp = await client.get(self.BASE_URL.format(ip=ip))
                resp.raise_for_status()
                data = resp.json()
                if data.get("status") == "success":
                    return (data.get("countryCode"), data.get("city"))
        except Exception as exc:
            logger.debug(f"GeoIP lookup failed for {ip}: {exc}")

        return (None, None)


geoip_service = GeoIPService()
