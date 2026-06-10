#!/usr/bin/env bash
# Local AI eval runner.
#
# Always runs the ML / deterministic evals (no API keys needed). Runs the LLM
# evals only when HELICONE_API_KEY + ANTHROPIC_API_KEY are both exported —
# otherwise it logs which are missing and skips them (same warn-first contract
# as CI). NEVER hard-codes secrets.
#
# Usage:
#   ./run-local.sh            # ML always; LLM if both keys are in the environment
#   HELICONE_API_KEY=... ANTHROPIC_API_KEY=... ./run-local.sh
#
# Optional: PROMPTFOO_PYTHON=/path/to/venv/python  (a python with the ai-service
# deps installed) if the default `python` on PATH can't import apps/ai-service.
set -euo pipefail

cd "$(dirname "$0")"

# Offline by default so the HF emotional model isn't downloaded; the service
# falls back to a neutral sub-score. USE_MOCK_SERVICES stubs external providers.
export USE_MOCK_SERVICES="${USE_MOCK_SERVICES:-true}"
export HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-1}"
export TRANSFORMERS_OFFLINE="${TRANSFORMERS_OFFLINE:-1}"

if [ ! -d node_modules ]; then
  echo "[evals] installing harness deps…"
  pnpm install --ignore-workspace
fi

echo "[evals] running ML / deterministic evals (no API keys required)…"
pnpm eval:ml

if [ -n "${HELICONE_API_KEY:-}" ] && [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "[evals] running LLM evals (Helicone-routed)…"
  pnpm eval:llm
else
  missing=""
  [ -z "${HELICONE_API_KEY:-}" ]  && missing="$missing HELICONE_API_KEY"
  [ -z "${ANTHROPIC_API_KEY:-}" ] && missing="$missing ANTHROPIC_API_KEY"
  echo "[evals] skipping LLM evals — missing:$missing"
  echo "[evals] export both keys and re-run to include them."
fi
