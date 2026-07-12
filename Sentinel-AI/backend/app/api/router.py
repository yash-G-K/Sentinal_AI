from fastapi import APIRouter

from app.api.endpoints import dashboard, analytics, threat_intelligence, requests, attacks, firewall, security_events, threat_reports, ip, audit, auth, users, settings, perf, domains

api_router = APIRouter()

api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(threat_intelligence.router, prefix="/threat-intelligence", tags=["Threat Intelligence"])
api_router.include_router(requests.router, prefix="/requests", tags=["Requests"])
api_router.include_router(attacks.router, prefix="/attacks", tags=["Attacks"])
api_router.include_router(firewall.router, prefix="/firewall", tags=["Firewall"])
api_router.include_router(security_events.router, prefix="/security-events", tags=["Security Events"])
api_router.include_router(threat_reports.router, prefix="/threat-reports", tags=["Threat Reports"])
api_router.include_router(ip.router, prefix="/ip", tags=["IP Reputation"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(perf.router, prefix="/perf", tags=["Performance"])
api_router.include_router(domains.router, prefix="/domains", tags=["Protected Domains"])
