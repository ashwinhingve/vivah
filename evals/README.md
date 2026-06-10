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
cd ../../evals && ./run-local.sh                # ML always; LLM only if both keys are exported
```

`run-local.sh` installs the harness if needed, always runs the ML evals, and runs the
LLM evals only when `HELICONE_API_KEY` + `ANTHROPIC_API_KEY` are both in the environment
(otherwise it logs which are missing and skips them). It NEVER hard-codes secrets.

Scripts (run any directly with `pnpm <name>`):

- `pnpm eval` — full suite (LLM + ML), interactive table.
- `pnpm eval:ml` — ML / deterministic features only (no API keys). Writes `results-ml.json`.
- `pnpm eval:llm` — LLM features only (needs both keys). Writes `results-llm.json`.
- `pnpm eval:ci` — full suite, non-interactive, writes `results.json`.

The ML/LLM split is by **provider** (`--filter-providers`): `ml_provider` for the Python
features, `anthropic` for the Helicone-routed LLM features.

> WSL note: if `pnpm eval:ml` crashes on a `better-sqlite3` "Could not locate the
> bindings file" error, run `pnpm rebuild better-sqlite3` once. If the default
> `python` can't import `apps/ai-service`, point the provider at a venv that can:
> `PROMPTFOO_PYTHON=/path/to/.venv/bin/python pnpm eval:ml`.

Golden cases live in `golden/<feature>.yaml`. Prompt builders in `prompts/` read the
**real** versioned prompts in `/prompts/*.md` (Coach/DPI/FII) and the inline assistant
system prompt extracted from `assistant_service.py` — so the eval tracks the live
prompt, not a copy.

## CI

Two jobs in `.github/workflows/ci.yml` run on PRs:

- **`AI Eval Suite (ML)`** — `pnpm eval:ml`. The 7 ML/deterministic features need no
  API keys, so this is a **required gate** (no `continue-on-error`). Finish promoting by
  adding `AI Eval Suite (ML)` to the branch-protection required status checks.
- **`AI Eval Suite (LLM)`** — `pnpm eval:llm`. **Warn-first** (`continue-on-error: true`).
  When the secrets below are absent the step skips cleanly (logged warning, exit 0); when
  present it runs the 4 Helicone-routed LLM features.

### Required GitHub secrets (LLM job only)

Add in **Settings → Secrets and variables → Actions** (only `VERCEL_PREVIEW_URL` exists today):

- `HELICONE_API_KEY`
- `ANTHROPIC_API_KEY`

Once both are set and the LLM evals are green across a few PRs, promote that job too:
drop `continue-on-error: true` from `eval-llm` and add `AI Eval Suite (LLM)` to branch
protection.
