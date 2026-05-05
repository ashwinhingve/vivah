"""
Internal-key auth dependency for AI service routes.

Per-route layer used via `Depends(verify_internal_key)`. Complements the global
InternalKeyAuthMiddleware in src.main: middleware enforces 401 for any
non-public path; this dependency adds 403 at the route boundary so individual
routers (e.g. coach, horoscope) can be reasoned about in isolation.
"""

from __future__ import annotations

import os

from fastapi import Header, HTTPException


def verify_internal_key(x_internal_key: str = Header(default="")) -> None:
    expected = os.getenv("AI_SERVICE_API_KEY") or os.getenv(
        "AI_SERVICE_INTERNAL_KEY", "internal-key-change-in-prod"
    )
    if x_internal_key != expected:
        raise HTTPException(status_code=403, detail="Invalid internal key")
