import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.database.database import SessionLocal
from app.models.request import Request as RequestModel, DecisionType, RequestMethod, RequestProtocol
from app.models.attack_log import AttackLog
from app.models.ip_reputation import ReputationStatus
from app.detectors import engine as detection_engine
from app.reputation.reputation_service import reputation_service
from app.firewall.firewall_engine import firewall_engine
from app.ai.ollama_service import ollama_service
from app.services.geoip_service import geoip_service
from app.websocket.manager import ws_manager
from app.services.cache_service import cache
from loguru import logger
import asyncio

# ── Internal origins to bypass the full WAF pipeline ──────────────────────────
# These are trusted sources (the dashboard's own frontend/backend calls)
_INTERNAL_IPS = frozenset(["127.0.0.1", "::1", "localhost"])
_BYPASS_PREFIXES = ("/api/v1", "/docs", "/redoc", "/openapi.json")

class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_uuid = str(uuid.uuid4())

        # Extract minimal request metadata (no body read yet — fast path first)
        client_ip  = request.client.host if request.client else "unknown"
        raw_method = request.method.upper()

        # ── Fast path 1: CORS Preflight ───────────────────────────────────────
        if raw_method == "OPTIONS":
            return await call_next(request)

        # ── Fast path 2: Internal/API bypass (localhost → /api/v1/*) ─────────
        # All dashboard frontend and backend-internal calls come from 127.0.0.1/::1.
        # These are already behind auth; skipping WAF saves ~2s per call.
        _path = request.url.path
        if client_ip in _INTERNAL_IPS and _path.startswith(_BYPASS_PREFIXES):
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_uuid
            return response

        # ── Full WAF path: read body only for external traffic ────────────────
        try:
            body_bytes = await request.body()
            async def receive() -> dict:
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            request._receive = receive
        except Exception as e:
            logger.warning(f"Failed to read request body: {e}")
            body_bytes = b""


        try:
            method = RequestMethod(raw_method)
        except ValueError:
            method = RequestMethod.GET # Fallback for unknown methods
            
        # Validate Protocol
        http_version = request.scope.get("http_version", "1.1")
        raw_protocol = f"HTTP/{http_version}"
        try:
            protocol = RequestProtocol(raw_protocol)
        except ValueError:
            protocol = RequestProtocol.HTTP_1_1

        host = request.headers.get("host", "")
        endpoint = request.url.path
        full_url = str(request.url)
        headers = dict(request.headers)
        cookies = dict(request.cookies)
        query_params = dict(request.query_params)
        user_agent = request.headers.get("user-agent", "")
        content_type = request.headers.get("content-type", "")
        
        try:
            content_length = int(request.headers.get("content-length", 0))
        except ValueError:
            content_length = 0
            
        body_decoded = body_bytes.decode('utf-8', errors='ignore')

        # Run Detection Engine and GeoIP lookup concurrently
        detection_result, (country, city) = await asyncio.gather(
            asyncio.to_thread(
                detection_engine.analyze_request,
                method=raw_method,
                full_url=full_url,
                headers=headers,
                query_params=query_params,
                body=body_decoded
            ),
            geoip_service.lookup(client_ip)
        )

        db = SessionLocal()
        final_decision = DecisionType.ALLOW
        new_request_id = None
        
        try:
            # Let Reputation Engine evaluate the request and handle counters
            attack_type_val = detection_result.attack_type if detection_result else None
            severity_val = detection_result.severity if detection_result else None
            
            rep_status = reputation_service.evaluate_request(
                db=db,
                ip_address=client_ip,
                attack_type=attack_type_val,
                severity=severity_val
            )

            # Insert Request first to get an ID for security events / attack logs
            new_request = RequestModel(
                request_uuid=request_uuid,
                ip_address=client_ip,
                method=method,
                protocol=protocol,
                host=host,
                endpoint=endpoint,
                full_url=full_url,
                query_params=query_params,
                headers=headers,
                cookies=cookies,
                body=body_decoded,
                user_agent=user_agent,
                content_type=content_type,
                content_length=content_length,
                response_status=0,  # Updated after response
                response_time_ms=0,  # Updated after response
                decision=DecisionType.ALLOW,  # Placeholder, updated below
                country=country,
                city=city,
            )
            db.add(new_request)
            db.flush() # Flush to get new_request.id
            new_request_id = new_request.id

            request_data = {
                "method": method.value,
                "path": endpoint,
                "headers": headers,
                "query_params": query_params,
                "body": body_decoded,
                "user_agent": user_agent,
                "country": country
            }

            # Evaluate final decision using the Firewall Engine
            final_decision = firewall_engine.evaluate(
                db=db,
                ip_address=client_ip,
                request_id=new_request.id,
                detector_result=detection_result,
                rep_status=rep_status,
                request_data=request_data
            )
            
            # Update request with the final firewall decision
            new_request.decision = final_decision

            # Store malicious detections in attack_logs
            if detection_result:
                attack_log = AttackLog(
                    request_id=new_request.id,
                    attack_type=detection_result.attack_type,
                    severity=detection_result.severity,
                    confidence=detection_result.confidence,
                    detector="Regex Engine",
                    matched_pattern=detection_result.matched_pattern,
                    payload_snippet=detection_result.payload_snippet,
                    blocked=(final_decision != DecisionType.ALLOW),
                    action=final_decision
                )
                db.add(attack_log)
                logger.warning(f"Detected {detection_result.attack_type.value} from {client_ip} (Confidence: {detection_result.confidence})")

                # ── WebSocket: broadcast threat event in real-time ─────────────
                asyncio.create_task(ws_manager.emit_threat({
                    "attack_type": detection_result.attack_type.value,
                    "severity":    detection_result.severity.value,
                    "confidence":  detection_result.confidence,
                    "ip":          client_ip,
                    "country":     country or "Unknown",
                    "endpoint":    endpoint,
                    "method":      raw_method,
                    "blocked":     (final_decision != DecisionType.ALLOW),
                    "ts":          __import__('datetime').datetime.utcnow().isoformat(),
                }))
                
                # Trigger Deep AI Analysis as a background task
                detector_result_dict = {
                    "attack_type": detection_result.attack_type.value,
                    "severity": detection_result.severity.value,
                    "matched_pattern": detection_result.matched_pattern
                }
                asyncio.create_task(
                    ollama_service.analyze_threat(
                        request_id=new_request.id,
                        method=raw_method,
                        url=full_url,
                        headers=headers,
                        body=body_decoded,
                        detector_result=detector_result_dict
                    )
                )

            db.commit()
            # Invalidate KPI cache — next dashboard poll will recompute from DB
            asyncio.create_task(cache.delete("dashboard:kpis"))
        except Exception as e:
            logger.error(f"Failed to process WAF logic: {e}")
            db.rollback()
        finally:
            db.close()

            
        # Execute the WAF decision
        if final_decision == DecisionType.BLOCK:
            from fastapi.responses import JSONResponse
            logger.info(f"WAF Blocked request {request_uuid} from {client_ip} -> {endpoint}")
            
            # Log the 403 back to the DB asynchronously or via a new session
            db = SessionLocal()
            try:
                req = db.query(RequestModel).get(new_request_id)
                if req:
                    req.response_status = 403
                    req.response_time_ms = int((time.time() - start_time) * 1000)
                    db.commit()
            finally:
                db.close()
                
            return JSONResponse(status_code=403, content={"detail": "Forbidden by WAF Policy", "request_id": request_uuid})

        # Process the request if ALLOW or QUARANTINE
        response = await call_next(request)
        
        process_time_ms = int((time.time() - start_time) * 1000)
        response_status = response.status_code
        
        # Update the request with the actual endpoint response data
        db = SessionLocal()
        try:
            req = db.query(RequestModel).get(new_request_id)
            if req:
                req.response_status = response_status
                req.response_time_ms = process_time_ms
                db.commit()
        except Exception as e:
            db.rollback()
        finally:
            db.close()

        logger.info(f"Allowed request {request_uuid} from {client_ip} -> {endpoint} [{response_status}] in {process_time_ms}ms")

        # ── WebSocket: emit allowed request event ──────────────────────────────
        asyncio.create_task(ws_manager.emit_request({
            "ip":          client_ip,
            "method":      raw_method,
            "endpoint":    endpoint,
            "status":      response_status,
            "duration_ms": process_time_ms,
            "country":     country or "Unknown",
            "decision":    "allow",
            "ts":          __import__('datetime').datetime.utcnow().isoformat(),
        }))
            
        # Attach the UUID to the response headers for traceability
        response.headers["X-Request-ID"] = request_uuid
        return response

def setup_request_logger(app):
    app.add_middleware(RequestLoggerMiddleware)
