"""
P3 router registration helper.

Isolates all P3-introduced FastAPI router mounts behind a single function so
src/main.py only changes by two lines (import + call). Future P3 routers are
added here, not in main.py — keeps the shared file low-churn.
"""

from __future__ import annotations

from fastapi import FastAPI

from src.routers.assistant import router as assistant_router
from src.routers.embedding import router as embedding_router


def register_p3_routers(app: FastAPI) -> None:
    """Mount all Phase 3 P3 routers on the given app."""
    app.include_router(assistant_router)
    app.include_router(embedding_router)
