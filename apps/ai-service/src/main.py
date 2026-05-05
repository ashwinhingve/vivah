"""
Smart Shaadi AI Service — entry point.

Stabilization (M2):
- X-Internal-Key auth middleware on every non-health route (G2).
- Sentry SDK init for error tracking (G8).
- structlog JSON logging (G8).
- /ready deeper liveness probe (G15).
"""

from __future__ import annotations

import logging
import os
import sys


from dotenv import load_dotenv
load_dotenv()
import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ── structlog setup (JSON output) ────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
    cache_logger_on_first_use=True,
)
log = structlog.get_logger("ai-service")

# ── Sentry init (no-op when SENTRY_DSN unset) ────────────────────────────────
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.05,
        send_default_pii=False,
        integrations=[FastApiIntegration()],
        environment=os.getenv("NODE_ENV", "development"),
    )
    log.info("sentry_initialized")
else:
    log.info("sentry_skipped", reason="SENTRY_DSN unset")

# ── App ──────────────────────────────────────────────────────────────────────
from src.routers.horoscope import router as horoscope_router
from src.routers.coach import router as coach_router
from src.routers.emotional import router as emotional_router

app = FastAPI(
    title="VivahOS AI Service",
    version="0.2.0",
    description="ML scoring, AI matchmaking, fraud detection",
)


# ── X-Internal-Key auth middleware ───────────────────────────────────────────
INTERNAL_KEY = (
    os.getenv("AI_SERVICE_API_KEY")
    or os.getenv("AI_SERVICE_INTERNAL_KEY", "internal-key-change-in-prod")
)
PUBLIC_PATHS = {"/health", "/ready", "/docs", "/openapi.json", "/redoc"}


class InternalKeyAuthMiddleware(BaseHTTPMiddleware):
    """
    Enforces X-Internal-Key on every route except PUBLIC_PATHS.

    The api service (apps/api) sends this header on every internal call;
    third parties cannot reach the AI endpoints directly without the key.

    In production (NODE_ENV=production) the placeholder default key is
    rejected at api-side env validation (apps/api/src/lib/env.ts superRefine),
    so the placeholder cannot reach a real deployment.
    """

    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        provided = request.headers.get("x-internal-key", "")
        if not provided or provided != INTERNAL_KEY:
            log.warning(
                "auth_denied",
                path=request.url.path,
                reason="missing_or_invalid_internal_key",
            )
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "data": None,
                    "error": "Unauthorized — missing or invalid X-Internal-Key",
                    "meta": None,
                },
            )

        return await call_next(request)


app.add_middleware(InternalKeyAuthMiddleware)
app.include_router(horoscope_router)
app.include_router(coach_router)
app.include_router(emotional_router)


# ── Health + readiness ───────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict[str, object]:
    """
    Liveness probe — process is up + Phase 3 model registry.

    Always returns HTTP 200. status="degraded" when a critical import fails so
    Railway/load-balancers don't loop-restart the pod for a recoverable issue.
    """
    status = "ok"
    try:
        # Smoke that the deterministic engine module is importable.
        from src.services.guna_milan import calculator  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        log.error("health_import_failed", error=str(exc))
        status = "degraded"

    # Emotional Score sentiment loader probe — never triggers a load (cheap).
    try:
        from src.services.sentiment_model import is_pipeline_loaded

        emotional_status = (
            "huggingface_loaded" if is_pipeline_loaded() else "huggingface_unavailable"
        )
    except Exception as exc:  # noqa: BLE001
        log.error("sentiment_health_probe_failed", error=str(exc))
        emotional_status = "huggingface_unavailable"

    return {
        "success": True,
        "data": {
            "status": status,
            "phase": 3,
            "version": "3.0.0",
            "models": {
                "guna_milan": "deterministic",
                "coach": "llm_sonnet",
                "emotional": emotional_status,
            },
        },
        "error": None,
        "meta": None,
    }


@app.get("/ready")
def ready() -> dict[str, object]:
    """
    Readiness probe — Guna Milan calculator is loadable + responding.
    Used by Railway / load balancers for traffic routing decisions.
    """
    try:
        from src.services.guna_milan import calculator

        # Smoke a known input — Aries (Mesha) × Aries (Mesha), nakshatra 1 each.
        result = calculator.calculate(
            boy_rashi="Mesha",
            boy_nak="Ashwini",
            girl_rashi="Mesha",
            girl_nak="Ashwini",
            boy_manglik=False,
            girl_manglik=False,
        )
        ok = result is not None
    except Exception as exc:  # noqa: BLE001
        log.error("ready_check_failed", error=str(exc))
        ok = False

    status_code = 200 if ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "success": ok,
            "data": {"status": "ready" if ok else "not_ready", "guna_calc": ok},
            "error": None,
            "meta": None,
        },
    )


# ── Forced-error endpoint for Sentry smoke ───────────────────────────────────
@app.get("/__forced_error")
def forced_error() -> dict[str, object]:
    """Test endpoint — raises so Sentry receives a sample event."""
    raise HTTPException(status_code=500, detail="forced error for Sentry smoke test")
