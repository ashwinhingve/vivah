"""
DPI (Divorce Probability Indicator) service.

Orchestrates:
 1. dpi_model.predict() — calibrated sklearn probability
 2. Factor direction classification
 3. Opus 4.7 narrative generation via Helicone proxy
 4. Forbidden-word post-validation
 5. Graceful fallback to MOCK_NARRATIVES on any LLM failure
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import structlog

from src.schemas.dpi import (
    DISCLAIMER,
    LEVEL_LABELS,
    DpiFactorContribution,
    DpiRequest,
    DpiResponse,
)
from src.services.dpi_model import FEATURE_NAMES, predict

log = structlog.get_logger("dpi-service")

# ---------------------------------------------------------------------------
# Mock narratives — used in mock mode and as LLM error fallback
# ---------------------------------------------------------------------------

MOCK_NARRATIVES: dict[str, dict[str, str]] = {
    "LOW": {
        "narrative": (
            "You share strong family values and have similar life perspectives. "
            "This is a great foundation for a meaningful relationship."
        ),
        "suggestion": (
            "Continue discussing your shared interests and life goals to deepen "
            "your understanding of each other."
        ),
    },
    "MEDIUM": {
        "narrative": (
            "You have several compatible traits and some differences worth exploring together. "
            "Open conversations about these areas will help you understand each other better."
        ),
        "suggestion": (
            "Spend time discussing your views on family roles and how you each imagine "
            "your future home life."
        ),
    },
    "HIGH": {
        "narrative": (
            "You have meaningful connections in some areas and notable differences in others. "
            "Honest conversations about these differences are important to understand if "
            "your visions align."
        ),
        "suggestion": (
            "Have a thoughtful discussion about your core values and long-term life "
            "expectations before moving forward."
        ),
    },
}

# ---------------------------------------------------------------------------
# Forbidden-word post-validator
# ---------------------------------------------------------------------------

_FORBIDDEN_PATTERN = re.compile(
    r"\b(fail|doomed|incompatible|wrong\s+match|divorce)\b",
    re.IGNORECASE,
)


def _contains_forbidden(text: str) -> bool:
    """Return True if text contains any forbidden word/phrase (whole-word match)."""
    return bool(_FORBIDDEN_PATTERN.search(text))


# ---------------------------------------------------------------------------
# XML parser
# ---------------------------------------------------------------------------


def _parse_narrative_xml(xml_text: str) -> tuple[str, str] | None:
    """
    Extract <narrative> and <suggestion> from Opus output.

    Returns (narrative, suggestion) or None if parsing fails.
    Tolerant of extra whitespace or surrounding text.
    """
    # Try structured XML parse first
    try:
        # Wrap in a root element to handle bare tags
        wrapped = f"<root>{xml_text}</root>"
        root = ET.fromstring(wrapped)
        narrative_el = root.find("narrative")
        suggestion_el = root.find("suggestion")
        if narrative_el is not None and suggestion_el is not None:
            n = (narrative_el.text or "").strip()
            s = (suggestion_el.text or "").strip()
            if n and s:
                return n, s
    except ET.ParseError:
        pass

    # Fallback: regex extraction (tolerant of malformed XML)
    n_match = re.search(r"<narrative>(.*?)</narrative>", xml_text, re.DOTALL)
    s_match = re.search(r"<suggestion>(.*?)</suggestion>", xml_text, re.DOTALL)
    if n_match and s_match:
        n = n_match.group(1).strip()
        s = s_match.group(1).strip()
        if n and s:
            return n, s

    return None


# ---------------------------------------------------------------------------
# Anthropic lazy singleton
# ---------------------------------------------------------------------------

_anthropic_client = None


def _get_anthropic():
    """Return a lazy-initialized Anthropic client (Helicone-proxied if key present)."""
    global _anthropic_client  # noqa: PLW0603
    if _anthropic_client is not None:
        return _anthropic_client
    try:
        import anthropic

        helicone_api_key = os.getenv("HELICONE_API_KEY", "")
        if helicone_api_key:
            _anthropic_client = anthropic.Anthropic(
                api_key=os.getenv("ANTHROPIC_API_KEY", ""),
                base_url="https://anthropic.helicone.ai",
                default_headers={
                    "Helicone-Auth": f"Bearer {helicone_api_key}",
                },
            )
        else:
            _anthropic_client = anthropic.Anthropic(
                api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            )
        return _anthropic_client
    except Exception as exc:  # noqa: BLE001
        log.warning("anthropic_init_failed", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Core service function
# ---------------------------------------------------------------------------


async def compute_dpi(
    request: DpiRequest,
    anthropic_client=None,
    use_mock: bool = True,
) -> DpiResponse:
    """
    Compute DPI score + Opus narrative for a profile pair.

    Steps:
    1. Call dpi_model.predict() with features → score, level, factor_contributions
    2. Map level → label via LEVEL_LABELS
    3. Classify top 3 factor directions
    4. If use_mock → return MOCK_NARRATIVES without LLM call
    5. Otherwise call claude-opus-4-7 via Helicone, parse XML
    6. Forbidden-word post-validation → fall back to mock if triggered
    7. On any LLM exception → fall back to mock silently
    8. Return fully populated DpiResponse
    """
    if anthropic_client is None:
        anthropic_client = _get_anthropic()

    # ── 1. Model prediction ──────────────────────────────────────────────────
    features_dict = request.features.model_dump()
    model_result = predict(features_dict)

    raw_score: float = float(model_result["score"])
    score = max(0.0, min(1.0, raw_score))
    level: str = model_result["level"]
    factor_contributions: dict[str, float] = model_result["factor_contributions"]

    # ── 2. Level → label ─────────────────────────────────────────────────────
    label = LEVEL_LABELS[level]

    # ── 3. Top 3 factor direction classification ─────────────────────────────
    top_3_names: list[str] = model_result["top_3_factors"]

    top_factors: list[DpiFactorContribution] = []
    for name in top_3_names[:3]:
        contrib = factor_contributions.get(name, 0.0)
        if contrib < -0.05:
            direction = "protective"
        elif contrib > 0.05:
            direction = "concern"
        else:
            direction = "neutral"
        top_factors.append(
            DpiFactorContribution(
                factor=name,
                contribution=contrib,
                direction=direction,  # type: ignore[arg-type]
            )
        )

    # ── 4. Mock mode ─────────────────────────────────────────────────────────
    if use_mock:
        mock = MOCK_NARRATIVES[level]
        return DpiResponse(
            score=score,
            level=level,  # type: ignore[arg-type]
            label=label,
            narrative=mock["narrative"],
            suggestion=mock["suggestion"],
            top_factors=top_factors,
            disclaimer=DISCLAIMER,
        )

    # ── 5. Load prompt ───────────────────────────────────────────────────────
    prompt_path = Path(__file__).parents[4] / "prompts" / "dpi-narrative-v1.md"
    try:
        system_prompt = prompt_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        log.error("dpi_prompt_not_found", path=str(prompt_path))
        mock = MOCK_NARRATIVES[level]
        return DpiResponse(
            score=score,
            level=level,  # type: ignore[arg-type]
            label=label,
            narrative=mock["narrative"],
            suggestion=mock["suggestion"],
            top_factors=top_factors,
            disclaimer=DISCLAIMER,
        )

    # ── 6. Build user content ────────────────────────────────────────────────
    top_factors_summary = ", ".join(
        f"{f.factor} ({f.direction})" for f in top_factors
    )
    shared_strengths_str = (
        ", ".join(request.shared_strengths) if request.shared_strengths else "none noted"
    )
    user_content = (
        f"Match level: {level}\n"
        f"Profile A: {request.profile_a_summary or 'Not provided'}\n"
        f"Profile B: {request.profile_b_summary or 'Not provided'}\n"
        f"Top factors of concern: {top_factors_summary}\n"
        f"Shared strengths: {shared_strengths_str}\n"
        f"Generate narrative + suggestion."
    )

    # ── 7. Helicone headers ──────────────────────────────────────────────────
    user_id_hash = hashlib.sha256(request.requesting_user_id.encode()).hexdigest()[:12]
    helicone_api_key = os.getenv("HELICONE_API_KEY", "")
    extra_headers: dict[str, str] = {
        "Helicone-Property-Feature": "dpi-narrative",
        "Helicone-User-Id": user_id_hash,
        "Helicone-Cache-Enabled": "true",
    }
    if helicone_api_key:
        extra_headers["Helicone-Auth"] = f"Bearer {helicone_api_key}"

    # ── 8. Call LLM ──────────────────────────────────────────────────────────
    narrative: str
    suggestion: str
    try:
        if anthropic_client is None:
            raise RuntimeError("Anthropic client not available")

        response = anthropic_client.messages.create(
            model="claude-opus-4-7",
            max_tokens=400,
            temperature=0.5,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
            extra_headers=extra_headers,
        )
        raw_text: str = response.content[0].text
        parsed = _parse_narrative_xml(raw_text)

        if parsed is None:
            log.warning("dpi_xml_parse_failed", fallback="mock", level=level)
            mock = MOCK_NARRATIVES[level]
            narrative = mock["narrative"]
            suggestion = mock["suggestion"]
        else:
            narrative, suggestion = parsed

            # ── 9. Forbidden-word post-validation ────────────────────────────
            if _contains_forbidden(narrative) or _contains_forbidden(suggestion):
                log.warning(
                    "dpi_forbidden_word_detected",
                    fallback="mock",
                    level=level,
                )
                mock = MOCK_NARRATIVES[level]
                narrative = mock["narrative"]
                suggestion = mock["suggestion"]

    except Exception as exc:  # noqa: BLE001
        log.warning("dpi_llm_exception", error=str(exc), fallback="mock", level=level)
        mock = MOCK_NARRATIVES[level]
        narrative = mock["narrative"]
        suggestion = mock["suggestion"]

    return DpiResponse(
        score=score,
        level=level,  # type: ignore[arg-type]
        label=label,
        narrative=narrative,
        suggestion=suggestion,
        top_factors=top_factors,
        disclaimer=DISCLAIMER,
    )
