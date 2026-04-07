# SME: AI Service Module — $ARGUMENTS
# Usage: /ai-module [feature-name]
# Use this command for ALL work in apps/ai-service/

## This Is Python, Not TypeScript

- All code goes in `apps/ai-service/`
- Language: Python 3.11+
- Framework: FastAPI
- Type hints everywhere — `def score(request: CompatibilityRequest) -> CompatibilityResponse:`

## LLM Calls — Always Via Helicone

```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://anthropic.helicone.ai",
    default_headers={
        "Helicone-Auth": f"Bearer {settings.HELICONE_API_KEY}"
    }
)
```

## Model Routing Rule

- `claude-haiku-4-5`: classification, bulk tasks, profile categorisation, simple scoring
- `claude-sonnet-4-6`: compatibility analysis, AI planner, emotional scoring, recommendations
- Never Opus unless explicitly approved — 5x cost

## Every Endpoint Must Have

1. Pydantic request schema (in `schemas/`)
2. Pydantic response schema (in `schemas/`)
3. Langfuse trace span wrapping the LLM call
4. Error handling for LLM failures (retry with exponential backoff)
5. FastAPI endpoint in the appropriate `routers/` file
6. Pytest test in `tests/` covering normal case + edge cases

## Langfuse Tracing (Required)

```python
from langfuse import Langfuse

langfuse = Langfuse()
trace = langfuse.trace(name="[feature-name]", user_id=user_id)
span = trace.span(name="llm-call")
# ... LLM call ...
span.end(output=response)
```

## Prompt Files

Store all prompts in `prompts/[feature]-v1.md`. Never hardcode prompts inline. Never edit a prompt in-place — always create a new version: `prompts/[feature]-v2.md`.

## Testing

```bash
cd apps/ai-service
source venv/bin/activate
pytest tests/test_[feature].py -v
```

Test edge cases for this project:
- Empty/incomplete profile data
- Extreme Guna Milan scores (0/36 and 36/36)
- Missing horoscope data (graceful fallback)
- LLM API timeout simulation
- Very long chat messages (token limit handling)
