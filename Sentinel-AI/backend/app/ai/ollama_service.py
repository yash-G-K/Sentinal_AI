"""
ollama_service.py
─────────────────
Async Ollama client with:
  • Circuit-breaker to stop retrying when Ollama is unavailable
  • Longer timeout (30 s) to survive cold model loads
  • Keeps AI disabled until a successful health-check passes
"""
import asyncio
import httpx
import json
import time
from typing import Optional, Dict, Any
from loguru import logger
from app.config.settings import settings
from app.models.ai_analysis import AIAnalysis
from app.models.attack_log import AttackType, SeverityLevel
from app.database.database import SessionLocal
from pydantic import BaseModel


class AIResponse(BaseModel):
    attack_type: str
    severity: str
    confidence: float
    explanation: str
    recommendation: str


class OllamaService:
    # ── Timeouts ───────────────────────────────────────────────────────────────
    # First request loads the model from disk — can take 20–40 s on CPU.
    # Subsequent requests (model cached in RAM) are fast (1–3 s).
    GENERATE_TIMEOUT = 45.0   # generous for cold-start
    HEALTH_TIMEOUT   = 5.0

    # ── Circuit-breaker ────────────────────────────────────────────────────────
    # After CIRCUIT_THRESHOLD consecutive failures, stop trying Ollama until
    # CIRCUIT_RESET_AFTER seconds have elapsed (then test once more).
    CIRCUIT_THRESHOLD    = 5
    CIRCUIT_RESET_AFTER  = 120   # 2 minutes

    def __init__(self):
        self.url       = f"{settings.OLLAMA_URL}/api/generate"
        self.health_url = f"{settings.OLLAMA_URL}/api/tags"
        self.model     = settings.OLLAMA_MODEL
        self.max_retries = 1          # Only one retry — fail fast

        # Circuit-breaker state
        self._fail_count   = 0
        self._circuit_open = False    # True → skip Ollama entirely
        self._opened_at    = 0.0

    # ── Public API ─────────────────────────────────────────────────────────────

    async def analyze_threat(
        self,
        request_id: int,
        method: str,
        url: str,
        headers: dict,
        body: str,
        detector_result: Dict[str, Any],
    ) -> None:
        """
        Async threat analysis via Ollama. Saves result to DB on success.
        Silently skips if AI is disabled or circuit is open.
        """
        if not settings.AI_ENABLED:
            return

        if self._is_circuit_open():
            logger.debug(f"[Ollama] Circuit open — skipping AI for request {request_id}")
            return

        prompt  = self._build_prompt(method, url, headers, body, detector_result)
        payload = {
            "model":  self.model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {
                "num_predict": 256,   # Cap token output for speed
                "temperature": 0,
            },
        }

        start_time    = time.time()
        raw_response  = ""
        tokens_used   = 0
        analysis: Optional[AIResponse] = None

        try:
            async with httpx.AsyncClient(timeout=self.GENERATE_TIMEOUT) as client:
                for attempt in range(self.max_retries + 1):
                    try:
                        resp = await client.post(self.url, json=payload)
                        resp.raise_for_status()
                        data         = resp.json()
                        raw_response = data.get("response", "{}")
                        tokens_used  = data.get("eval_count", 0)

                        try:
                            parsed   = json.loads(raw_response)
                            analysis = AIResponse(**parsed)
                            self._record_success()
                            break
                        except (json.JSONDecodeError, Exception) as parse_err:
                            logger.warning(f"[Ollama] Bad JSON on attempt {attempt+1}: {parse_err}")

                    except httpx.TimeoutException:
                        logger.warning(
                            f"[Ollama] Timeout on attempt {attempt+1} for request {request_id}. "
                            f"Model may be cold-loading. Consider running: ollama run {self.model} ping"
                        )
                        self._record_failure()
                        break  # Don't retry on timeout — it will timeout again

                    except httpx.RequestError as exc:
                        logger.warning(f"[Ollama] Connection error on attempt {attempt+1}: {exc}")
                        self._record_failure()
                        if attempt < self.max_retries:
                            await asyncio.sleep(0.5)

                    except httpx.HTTPStatusError as exc:
                        logger.warning(f"[Ollama] HTTP {exc.response.status_code} on attempt {attempt+1}")
                        self._record_failure()
                        break

        except Exception as exc:
            logger.warning(f"[Ollama] Unexpected error for request {request_id}: {exc}")
            self._record_failure()

        processing_time_ms = int((time.time() - start_time) * 1000)

        if analysis:
            logger.info(f"[Ollama] Analysis complete for request {request_id} in {processing_time_ms}ms")
            self._save_analysis(
                request_id=request_id,
                prompt=prompt,
                raw_response=raw_response,
                parsed=analysis,
                tokens_used=tokens_used,
                processing_time_ms=processing_time_ms,
            )
        else:
            logger.debug(
                f"[Ollama] Analysis skipped/failed for request {request_id}. "
                f"Rule-based detection still applied. "
                f"Circuit failures: {self._fail_count}/{self.CIRCUIT_THRESHOLD}"
            )

    async def health_check(self) -> bool:
        """Returns True if Ollama is reachable and the model is available."""
        try:
            async with httpx.AsyncClient(timeout=self.HEALTH_TIMEOUT) as client:
                resp = await client.get(self.health_url)
                resp.raise_for_status()
                data   = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                ok     = any(self.model in m for m in models)
                if ok:
                    logger.info(f"[Ollama] Health check passed — model '{self.model}' available")
                    self._record_success()
                else:
                    logger.warning(f"[Ollama] Model '{self.model}' not found. Available: {models}")
                return ok
        except Exception as exc:
            logger.warning(f"[Ollama] Health check failed: {exc}")
            return False

    # ── Circuit-breaker helpers ────────────────────────────────────────────────

    def _is_circuit_open(self) -> bool:
        if not self._circuit_open:
            return False
        if time.time() - self._opened_at >= self.CIRCUIT_RESET_AFTER:
            logger.info("[Ollama] Circuit half-open — will test one request")
            self._circuit_open = False
            self._fail_count   = 0
            return False
        return True

    def _record_failure(self) -> None:
        self._fail_count += 1
        if self._fail_count >= self.CIRCUIT_THRESHOLD and not self._circuit_open:
            self._circuit_open = True
            self._opened_at    = time.time()
            logger.warning(
                f"[Ollama] Circuit OPEN after {self._fail_count} failures. "
                f"AI analysis paused for {self.CIRCUIT_RESET_AFTER}s. "
                f"Rule-based WAF continues normally."
            )

    def _record_success(self) -> None:
        if self._fail_count > 0:
            logger.info(f"[Ollama] Recovered after {self._fail_count} failures. Circuit CLOSED.")
        self._fail_count   = 0
        self._circuit_open = False

    # ── DB Save ────────────────────────────────────────────────────────────────

    def _save_analysis(
        self,
        request_id: int,
        prompt: str,
        raw_response: str,
        parsed: AIResponse,
        tokens_used: int,
        processing_time_ms: int,
    ) -> None:
        db = SessionLocal()
        try:
            try:
                attack_type = AttackType(parsed.attack_type.upper())
            except ValueError:
                attack_type = AttackType.UNKNOWN

            try:
                severity = SeverityLevel(parsed.severity.upper())
            except ValueError:
                severity = SeverityLevel.LOW

            ai_record = AIAnalysis(
                request_id=request_id,
                model_name=self.model,
                prompt=prompt,
                raw_response=raw_response,
                summary=parsed.explanation[:255] if parsed.explanation else "",
                attack_type=attack_type,
                severity=severity,
                confidence=parsed.confidence,
                explanation=parsed.explanation,
                recommendation=parsed.recommendation,
                tokens_used=tokens_used,
                processing_time_ms=processing_time_ms,
            )
            db.add(ai_record)
            db.commit()
            logger.info(f"[Ollama] AI analysis saved for request {request_id}")
        except Exception as exc:
            logger.error(f"[Ollama] Failed to save AI analysis: {exc}")
            db.rollback()
        finally:
            db.close()

    # ── Prompt ─────────────────────────────────────────────────────────────────

    def _build_prompt(self, method: str, url: str, headers: dict, body: str, detector_result: dict) -> str:
        # Trim body to avoid huge prompts that slow inference
        body_snippet = (body or "")[:500]
        headers_clean = {k: v for k, v in (headers or {}).items() if k.lower() not in ("cookie", "authorization")}
        return f"""You are Sentinel AI, a WAF threat analyst.
A rule-based detector flagged this HTTP request.

DETECTOR: attack_type={detector_result.get('attack_type')} severity={detector_result.get('severity')} pattern={detector_result.get('matched_pattern')}

REQUEST: {method} {url}
Headers: {json.dumps(headers_clean)}
Body: {body_snippet}

Respond ONLY with valid JSON:
{{"attack_type":"SQLI"|"XSS"|"COMMAND_INJECTION"|"PATH_TRAVERSAL"|"BOT"|"UNKNOWN","severity":"LOW"|"MEDIUM"|"HIGH"|"CRITICAL","confidence":<0.0-100.0>,"explanation":"<why>","recommendation":"<fix>"}}"""


ollama_service = OllamaService()
