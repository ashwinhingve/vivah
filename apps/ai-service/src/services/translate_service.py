"""
Hindi <-> English translation service.

Uses HuggingFace Helsinki-NLP/opus-mt-* models. Pipelines are loaded lazily
and cached at module scope so cold-start cost is paid only once per direction.

Direction routing:
  target='hi'  -> Helsinki-NLP/opus-mt-en-hi
  target='en'  -> Helsinki-NLP/opus-mt-hi-en

Tests inject a fake pipeline via _set_pipeline_for_testing() to avoid the
model download on CI.
"""

from __future__ import annotations

from typing import Callable, Dict

from src.schemas.translate import TranslateRequest, TranslateResponse

MODEL_MAP: Dict[str, str] = {
    "hi": "Helsinki-NLP/opus-mt-en-hi",
    "en": "Helsinki-NLP/opus-mt-hi-en",
}

PipelineLike = Callable[[str], list]

_pipelines: Dict[str, PipelineLike] = {}


def _load_pipeline(target: str) -> PipelineLike:
    """Lazily build a HuggingFace translation pipeline for the given target."""
    if target not in MODEL_MAP:
        raise ValueError(f"Unsupported translation target: {target}")
    cached = _pipelines.get(target)
    if cached is not None:
        return cached
    # Local import — avoids pulling torch at module-import time for code paths
    # that never call translate (tests, fast cold-start workers).
    from transformers import pipeline  # type: ignore[import-untyped]

    pipe = pipeline("translation", model=MODEL_MAP[target])
    _pipelines[target] = pipe
    return pipe


def _set_pipeline_for_testing(target: str, fake_pipeline: PipelineLike) -> None:
    """Test hook to bypass model download."""
    _pipelines[target] = fake_pipeline


def _reset_pipelines_for_testing() -> None:
    """Clear cached pipelines between tests."""
    _pipelines.clear()


async def translate(request: TranslateRequest) -> TranslateResponse:
    pipe = _load_pipeline(request.target)
    result = pipe(request.text)
    if not result:
        translated = request.text
    else:
        first = result[0]
        translated = first.get("translation_text") if isinstance(first, dict) else str(first)
        if not translated:
            translated = request.text
    return TranslateResponse(
        translated=translated,
        model=MODEL_MAP[request.target],
        target=request.target,
    )
