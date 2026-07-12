import asyncio
import json
import httpx
from datetime import datetime, timedelta
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.database import SessionLocal
from app.models.request import Request
from app.models.attack_log import AttackLog, AttackType
from app.models.threat_report import ThreatReport, ReportGenerator
from app.models.security_event import SecurityEvent
from app.models.attack_log import SeverityLevel
from app.firewall.firewall_engine import firewall_engine
from app.config.settings import settings

class ThreatIntelligenceAgent:
    def __init__(self):
        self.evaluation_interval_minutes = 60
        self.attack_threshold_for_block = 10 # 10 attacks in the interval triggers a harsh block

    async def run_evaluation(self):
        """Main loop executed by the scheduler."""
        logger.info("Threat Intelligence Agent: Starting evaluation cycle.")
        db = SessionLocal()
        try:
            time_window = datetime.utcnow() - timedelta(minutes=self.evaluation_interval_minutes)

            # 1. Evaluate Recent Attacks
            recent_attacks = db.query(AttackLog).filter(AttackLog.detected_at >= time_window).all()
            total_recent = len(recent_attacks)

            if total_recent == 0:
                logger.info("Threat Intelligence Agent: No attacks in the recent window. Coasting.")
                return

            # 2. Analyze Repeated IPs
            ip_attack_counts = db.query(
                Request.ip_address, 
                func.count(AttackLog.id).label("attack_count")
            ).join(AttackLog, AttackLog.request_id == Request.id)\
             .filter(AttackLog.detected_at >= time_window)\
             .group_by(Request.ip_address).all()

            top_attacker_ip = None
            max_attacks = 0
            
            for ip, count in ip_attack_counts:
                if count > max_attacks:
                    max_attacks = count
                    top_attacker_ip = ip

                # Automatically create extended temporary blocks for aggressive IPs
                if count >= self.attack_threshold_for_block:
                    firewall_engine._apply_temporary_block(
                        db, ip, 
                        reason=f"Threat Agent: High frequency attacks detected ({count} in {self.evaluation_interval_minutes}m)."
                    )
                    
                    event = SecurityEvent(
                        event_type="THREAT_AGENT_BLOCK",
                        severity=SeverityLevel.CRITICAL,
                        message=f"Threat Agent automatically extended block for aggressive IP: {ip}",
                        source="Threat Intelligence Agent"
                    )
                    db.add(event)

            # 3. Analyze Attack Trends
            attack_type_counts = db.query(
                AttackLog.attack_type, 
                func.count(AttackLog.id).label("type_count")
            ).filter(AttackLog.detected_at >= time_window)\
             .group_by(AttackLog.attack_type).order_by(func.count(AttackLog.id).desc()).all()

            top_attack_type = attack_type_counts[0][0] if attack_type_counts else AttackType.UNKNOWN
            
            trend_summary = f"Detected {total_recent} attacks in the last {self.evaluation_interval_minutes} minutes. "
            trend_summary += f"The most prominent attack vector was {top_attack_type.value}. "
            if top_attacker_ip:
                trend_summary += f"The most aggressive IP was {top_attacker_ip} with {max_attacks} attacks."

            # 4. Use AI to generate a tactical recommendation
            recommendation = "Enable strict rate limiting and monitor traffic."
            if settings.AI_ENABLED:
                recommendation = await self._get_ai_recommendation(trend_summary)

            # 5. Generate Threat Report
            report = ThreatReport(
                report_name=f"Hourly Threat Intel - {datetime.utcnow().strftime('%Y-%m-%d %H:00')}",
                summary=trend_summary,
                total_requests=total_recent, # Simplifying to total attacks for the report scope
                blocked_requests=total_recent, 
                top_attack=top_attack_type,
                top_ip=top_attacker_ip,
                generated_by=ReportGenerator.AI if settings.AI_ENABLED else ReportGenerator.SYSTEM,
                recommendation=recommendation
            )
            db.add(report)
            db.commit()

            logger.info(f"Threat Intelligence Agent: Generated Threat Report {report.id}")

        except Exception as e:
            logger.error(f"Threat Intelligence Agent encountered an error: {e}")
            db.rollback()
        finally:
            db.close()

    async def _get_ai_recommendation(self, trend_summary: str) -> str:
        """Asks Ollama for strategic firewall recommendations based on the trend."""
        prompt = f"""You are Sentinel AI, an expert Threat Intelligence Agent.
Based on the following recent attack trend summary, provide a concise, 1-2 sentence recommendation for the firewall administrator.

TREND SUMMARY:
{trend_summary}

Respond ONLY with the recommendation text."""
        
        url = f"{settings.OLLAMA_URL}/api/generate"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("response", "Apply strict filtering.").strip()
        except Exception as e:
            logger.warning(f"Failed to get AI recommendation for threat report: {e}")
            return "Monitor traffic closely."

threat_agent = ThreatIntelligenceAgent()
