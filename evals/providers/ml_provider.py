"""
promptfoo Python provider for the ML / deterministic AI features.

These features are not LLM calls, so they do not route through Helicone — the
provider imports the real ai-service service functions and runs them on golden
inputs. promptfooconfig.yaml then asserts output STRUCTURE + value RANGES
(e.g. Guna Milan total in [0,36] with all 8 Ashtakoot factors; churn / FAQ
probabilities in [0,1]; valid tier/band labels).

Invocation contract (promptfoo): each test renders a JSON string of
`{"feature": "...", "payload": {...}}` as the prompt; call_api parses it,
dispatches to the matching service, and returns the result as JSON text.

Models self-bootstrap: faq/stay auto-train on first load; the emotional
sentiment pipeline returns None offline and the service falls back to a
neutral sub-score, so this provider runs without network access.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

# ai-service uses absolute `from src.services...` imports — put its root on the path.
AI_SERVICE_ROOT = Path(__file__).resolve().parents[2] / "apps" / "ai-service"
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

os.environ.setdefault("USE_MOCK_SERVICES", "true")
os.environ.setdefault("AI_SERVICE_API_KEY", "eval-internal-key")


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _dump(model) -> str:
    """Pydantic v2 model -> JSON string."""
    return model.model_dump_json()


def _faq(payload):
    from src.schemas.faq import FaqRequest
    from src.services.faq_service import compute_faq
    return _dump(_run(compute_faq(FaqRequest(**payload))))


def _stay(payload):
    from src.schemas.stay import StayRequest
    from src.services.stay_service import compute_stay
    return _dump(_run(compute_stay(StayRequest(**payload))))


def _reputation(payload):
    from src.schemas.reputation import ReputationRequest
    from src.services.reputation_service import compute_reputation
    return _dump(compute_reputation(ReputationRequest(**payload)))


def _profile_optimizer(payload):
    from src.schemas.profile_optimizer import ProfileOptimizerRequest
    from src.services.profile_optimizer_service import compute_profile_optimizer
    return _dump(compute_profile_optimizer(ProfileOptimizerRequest(**payload)))


def _marriage_readiness(payload):
    from src.schemas.marriage_readiness import MarriageReadinessRequest
    from src.services.marriage_readiness_service import compute_marriage_readiness
    return _dump(compute_marriage_readiness(MarriageReadinessRequest(**payload)))


def _emotional(payload):
    from src.schemas.emotional import EmotionalScoreRequest
    from src.services.emotional_service import compute_emotional_score
    try:
        from src.services.sentiment_model import load_sentiment_pipeline
        pipeline = load_sentiment_pipeline()
    except Exception:
        pipeline = None  # offline → service falls back to neutral sentiment
    return _dump(_run(compute_emotional_score(request=EmotionalScoreRequest(**payload), pipeline=pipeline)))


def _guna_milan(payload):
    from src.services.guna_milan import calculator
    a = payload["profile_a"]
    b = payload["profile_b"]
    result = calculator.calculate(
        boy_rashi=a["rashi"],
        boy_nak=a["nakshatra"],
        girl_rashi=b["rashi"],
        girl_nak=b["nakshatra"],
        boy_manglik=a.get("manglik", False),
        girl_manglik=b.get("manglik", False),
    )
    return json.dumps(result, default=str)


_DISPATCH = {
    "faq": _faq,
    "stay": _stay,
    "reputation": _reputation,
    "profile_optimizer": _profile_optimizer,
    "marriage_readiness": _marriage_readiness,
    "emotional": _emotional,
    "guna_milan": _guna_milan,
}


def call_api(prompt, options, context):
    """promptfoo entry point. `prompt` is a JSON string {feature, payload}."""
    try:
        spec = json.loads(prompt)
        feature = spec["feature"]
        payload = spec.get("payload", {})
        if feature not in _DISPATCH:
            return {"error": f"unknown feature '{feature}'"}
        return {"output": _DISPATCH[feature](payload)}
    except Exception as exc:  # surface as a graded failure, not a crash
        return {"error": f"{type(exc).__name__}: {exc}"}
