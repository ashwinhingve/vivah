# AI Eval Harness

Regression evals for the 11 AI features. Catches prompt edits / model bumps that
silently break output structure or safety behaviour — before they ship.

## What it covers

| Feature | Engine | Provider | Key assertions |
|---|---|---|---|
| Conversation Coach | Sonnet | Helicone | 3-suggestion XML; **does not echo Profile B's private content**; no physical/romantic suggestions |
| DPI narrative | Opus | Helicone | `<narrative>/<suggestion>` XML; **no forbidden words; no probability/% leak** (user-visible only) |
| FII narrative | Sonnet | Helicone | `<narrative>/<discussion_starter>` XML; non-judgmental (no forbidden words) |
| Matrimony Assistant | Sonnet | Helicone | grounded in RAG context; **refuses to leak other users' contact info** |
| Emotional Score | HF model | Python | score∈[0,100]; valid label/trend; 4-part breakdown |
| FAQ | sklearn | Python | probability∈[0,1]; valid band/direction |
| Stay Quotient | sklearn | Python | churn∈[0,1]; valid risk band |
| Guna Milan | Vedic math | Python | total∈[0,36], max=36, all 8 Ashtakoot factors |
| Reputation | sklearn | Python | score∈[0,100]; valid tier; disclaimer present |
| Profile Optimizer | rules | Python | score∈[0,100]; valid tier; 3 dimensions; suggestions[] |
| Marriage Readiness | rules | Python | score∈[0,100]; 3 dimensions; next_actions[] |

The 4 LLM features route through the Helicone proxy (`https://anthropic.helicone.ai`),
the same path the services use in production. The 7 ML/deterministic features run
the **real** `apps/ai-service` functions via `providers/ml_provider.py` (no LLM, so
no Helicone) — models self-bootstrap (faq/stay auto-train; the emotional sentiment
pipeline tolerates offline and falls back to a neutral sub-score).

## Run locally

```bash
cd apps/ai-service && pip install -e ".[dev]"   # once — lets the Python provider import services
cd ../../evals && pnpm install
HELICONE_API_KEY=... ANTHROPIC_API_KEY=... pnpm eval
```

- `pnpm eval` — full suite (LLM + ML).
- `pnpm eval:ci` — non-interactive, writes `results.json`.
- LLM tests need `ANTHROPIC_API_KEY` + `HELICONE_API_KEY`; ML tests need neither.

Golden cases live in `golden/<feature>.yaml`. Prompt builders in `prompts/` read the
**real** versioned prompts in `/prompts/*.md` (Coach/DPI/FII) and the inline assistant
system prompt extracted from `assistant_service.py` — so the eval tracks the live
prompt, not a copy.

## CI

The `AI Eval Suite` job in `.github/workflows/ci.yml` runs `pnpm eval:ci` on PRs.

**Warn-first → required.** It currently runs with `continue-on-error: true` so a flaky
or model-drift failure surfaces as a warning without blocking merges. Once it has been
green across a few PRs, promote it to a required check by:

1. Removing `continue-on-error: true` from the `eval` job.
2. Adding **AI Eval Suite** to the branch-protection required status checks.

### Required GitHub secrets (set before the job can call Helicone)

The job reads two repo secrets — add them in **Settings → Secrets and variables →
Actions** (only `VERCEL_PREVIEW_URL` exists today):

- `HELICONE_API_KEY`
- `ANTHROPIC_API_KEY`

Until both are set, the LLM tests error (and, while warn-first, do not block).
