"""Thin Sentry wrapper — safe no-op when Sentry is unset or absent.

Used to make LLM-fallback paths *visible*. Several feature services (coach, dpi,
fii) intentionally degrade to template/mock output on any LLM error so they never
5xx the user — good UX, but historically invisible: a real production outage
looked identical to normal operation. Capturing the exception here keeps the
graceful degrade AND surfaces the failure in monitoring.

Never raises; never sends PII (only short tags).
"""

from __future__ import annotations

from typing import Any

try:  # optional dependency / DSN may be unset
    import sentry_sdk
except ImportError:  # pragma: no cover
    sentry_sdk = None  # type: ignore[assignment]


def _scoped():
    """Context manager for a fresh, isolated Sentry scope.

    Prefers ``new_scope`` (sentry-sdk 2.x); falls back to ``push_scope`` (1.x).
    """
    factory = getattr(sentry_sdk, "new_scope", None) or sentry_sdk.push_scope
    return factory()


def capture_exception(exc: BaseException, **tags: Any) -> None:
    """Report an exception to Sentry with optional short tags. No-op if unavailable."""
    if sentry_sdk is None:
        return
    try:
        if tags:
            with _scoped() as scope:
                for key, value in tags.items():
                    scope.set_tag(key, str(value))
                sentry_sdk.capture_exception(exc)
        else:
            sentry_sdk.capture_exception(exc)
    except Exception:  # pragma: no cover - telemetry must never break the caller
        pass


def capture_message(message: str, **tags: Any) -> None:
    """Report a message to Sentry with optional short tags. No-op if unavailable."""
    if sentry_sdk is None:
        return
    try:
        if tags:
            with _scoped() as scope:
                for key, value in tags.items():
                    scope.set_tag(key, str(value))
                sentry_sdk.capture_message(message)
        else:
            sentry_sdk.capture_message(message)
    except Exception:  # pragma: no cover
        pass
