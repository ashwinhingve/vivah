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
from datetime import datetime, timezone


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

    try:
        traces_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    except ValueError:
        traces_rate = 0.1

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=traces_rate,
        send_default_pii=False,
        integrations=[FastApiIntegration()],
        environment=os.getenv("SENTRY_ENVIRONMENT", os.getenv("NODE_ENV", "development")),
        release=os.getenv("GIT_COMMIT_SHA") or None,
    )
    log.info("sentry_initialized", traces_sample_rate=traces_rate)
else:
    log.info("sentry_skipped", reason="SENTRY_DSN unset")

# ── App ──────────────────────────────────────────────────────────────────────
from src.routers.horoscope import router as horoscope_router
from src.routers.coach import router as coach_router
from src.routers.emotional import router as emotional_router
from src.routers.dpi import router as dpi_router
from src.routers.fii import router as fii_router
from src.routers.faq import router as faq_router
from src.routers.stay import router as stay_router
from src.routers.translate import router as translate_router
from src.routers.reputation import router as reputation_router
from src.routers.profile_optimizer import router as profile_optimizer_router
from src.routers.marriage_readiness import router as marriage_readiness_router
from src.routers.calendar import router as calendar_router
from src.routers.pricing import router as pricing_router
from src.routers._p3_register import register_p3_routers

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
app.include_router(dpi_router)
app.include_router(fii_router)
app.include_router(faq_router)
app.include_router(stay_router)
app.include_router(translate_router)
app.include_router(reputation_router)
app.include_router(profile_optimizer_router)
app.include_router(marriage_readiness_router)
app.include_router(calendar_router)
app.include_router(pricing_router)
register_p3_routers(app)


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

    # Emotional Score sentiment loader probe — first call triggers lazy load,
    # subsequent calls return the cached pipeline via `_load_attempted` guard.
    # Sentiment HF pipeline — cheap status; does NOT trigger a 1GB model download.
    # Models warm lazily on the first real inference request.
    try:
        from src.services.sentiment_model import is_pipeline_loaded

        emotional_status = "huggingface_loaded" if is_pipeline_loaded() else "huggingface_cold"
    except Exception as exc:  # noqa: BLE001
        log.error("sentiment_health_probe_failed", error=str(exc))
        emotional_status = "huggingface_unavailable"

    # DPI sklearn — cheap status; bundle lazy-loads on first prediction.
    try:
        from src.services.dpi_model import is_loaded as dpi_is_loaded

        dpi_status = "sklearn_loaded" if dpi_is_loaded() else "sklearn_cold"
    except Exception as exc:  # noqa: BLE001
        log.error("dpi_health_probe_failed", error=str(exc))
        dpi_status = "sklearn_unavailable"

    # FAQ GradientBoosting — cheap status; bundle lazy-loads on first prediction.
    try:
        from src.services.faq_model import is_loaded as faq_is_loaded

        faq_status = "sklearn_loaded" if faq_is_loaded() else "sklearn_cold"
    except Exception as exc:  # noqa: BLE001
        log.error("faq_health_probe_failed", error=str(exc))
        faq_status = "sklearn_unavailable"

    # Stay Quotient sklearn — cheap status; bundle lazy-loads on first prediction.
    try:
        from src.services.stay_model import is_loaded as stay_is_loaded

        stay_status = "sklearn_loaded" if stay_is_loaded() else "sklearn_cold"
    except Exception as exc:  # noqa: BLE001
        log.error("stay_health_probe_failed", error=str(exc))
        stay_status = "sklearn_unavailable"

    return {
        "success": True,
        "data": {
            "status": status,
            "phase": 3,
            "version": "3.0.0",
            "llm_provider": os.getenv("LLM_PROVIDER", "anthropic"),
            "models": {
                "guna_milan": "deterministic",
                "coach": "llm_sonnet",
                "emotional": emotional_status,
                "dpi": dpi_status,
                "faq": faq_status,
                "stay": stay_status,
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


# ── Sentry verification endpoint ─────────────────────────────────────────────
# Gated behind SENTRY_TEST_ENABLED env flag (default false → 404).
# Enable ONLY for production deploy verification, then disable.
# SECURITY: This endpoint raises an unhandled exception — never expose
# publicly without the flag gate. Leaving SENTRY_TEST_ENABLED=true in prod
# gives any caller a one-shot 5xx generator and pollutes Sentry signal.
@app.get("/__forced_error")
def forced_error() -> dict[str, object]:
    if os.getenv("SENTRY_TEST_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not Found")
    raise RuntimeError(f"Sentry test from ai-service — {datetime.now(timezone.utc).isoformat()}")
