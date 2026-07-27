# Smart Shaadi — Audit PASS 1: Findings Log

> **Audit and fix are separated.** This file *records* findings; it does not fix
> them. Each finding is evidence-backed (file:line) and carries a severity. A
> proposed remediation may be noted, but is **deferred** until a fix pass is
> explicitly authorised. Ground-truth inventory: `PASS-0-INVENTORY.md`.

**Severity scale**
- **P0** — active breakage / data-loss / security exposure now.
- **P1** — latent break that can take a core flow down with no code change on our side (deploy/dependency/data-triggered), or a silent-correctness hazard on a core path.
- **P2** — correctness/robustness gap with limited blast radius; cleanup.

| ID | Sev | Title | Area | Status |
|---|---|---|---|---|
| P1-001 | **P1** | sklearn model bundles deserialize with no version guard on unbounded numpy/sklearn | ai-service | OPEN (not fixed) |

---

## P1-001 — sklearn model deserialization is unguarded on unbounded numpy/sklearn pins

**Severity:** P1 · **Area:** `apps/ai-service` (matchmaking/profile scoring dependency) · **Status:** OPEN — logged, **not fixed** (fix deferred per audit/fix separation).

### What
Four scikit-learn model bundles — `dpi_model.pkl`, `faq_model.pkl`, `reputation_model.pkl`, `stay_model.pkl` (under `apps/ai-service/models/`) — are loaded via bare `joblib.load()` with **no version guard and no `try/except`**, against **floating, upper-unbounded** dependency pins. A transitive numpy/scikit-learn bump can make deserialization throw at scoring time, with **no code change on our side**.

### Evidence (verified 2026-07-26)
- Unguarded loads (each is `bundle = joblib.load(model_path)` with no surrounding `try/except`, no sklearn-version check):
  - `apps/ai-service/src/services/dpi_model.py:70`
  - `apps/ai-service/src/services/faq_model.py:59`
  - `apps/ai-service/src/services/reputation_model.py:71`
  - `apps/ai-service/src/services/stay_model.py:79`
- **Floating / unbounded deps** — `apps/ai-service/pyproject.toml:10-12`:
  - `scikit-learn>=1.5.0`
  - `joblib>=1.4.0`
  - `numpy>=2.0.0`  ← no upper bound; next resolve pulls whatever numpy is latest
- **Artifacts are not tracked in git** — `git ls-files apps/ai-service/models/` returns **empty**; the 4 `.pkl` files exist only on disk, produced by a train-on-miss fallback.
- **The fallback only checks existence, not loadability** — e.g. `faq_model.py:56-59` / `dpi_model.py:67-70`:
  ```python
  if not model_path.exists():
      train_model(save_path=model_path, metadata_path=metadata_path)
  bundle = joblib.load(model_path)   # <-- a present-but-incompatible file is never regenerated; this line throws
  ```

### Failure mode (why it's P1, not P2)
The self-healing retrain is defeated by the exact condition that triggers the break. If a `.pkl` produced under one numpy/sklearn version **survives** into an environment with a newer version — a persistent volume, a Docker layer that baked the models, a cached build layer, or a warm dev/CI venv that `pip install --upgrade`s in place — then:
1. `model_path.exists()` is **true**, so the retrain fallback does **not** fire, but
2. `joblib.load()` raises (numpy 2.0 renamed `numpy.core`→`numpy._core`, breaking cross-version array unpickling; sklearn raises `InconsistentVersionWarning` and can hard-fail on pickled estimator internals), and
3. there is **no `try/except`**, so the exception propagates and the endpoint 500s — permanently, until the stale file is manually deleted.

The break is **silent and deploy-triggered**: it needs no change to our code, only a dependency resolve or a base-image refresh.

### Blast radius
- **DPI** (divorcee/widow support scoring), **FAQ** (vendor), **Reputation**, **Stay-Quotient** (churn) all go down together.
- Reputation and DPI feed profile/match signals. **Open question for a later pass:** does the API match-scoring / feed path treat these ai-service calls as *required* (hard-fail → matchmaking scoring goes down) or *degrade gracefully*? The user's stated concern is the hard-fail case. Verify the API's handling of ai-service errors on the feed path (`apps/api/src/matchmaking/*` → ai-service calls) before sizing customer impact.
- Secondary hazard even on the "train-fresh" path: an sklearn minor bump can silently shift calibration/scores (correctness drift, not a crash) because nothing pins the training-time version.

### Proposed remediation — DEFERRED (do not apply in an audit pass)
Any one (or combination) would close it; recorded here so it isn't lost:
- Add **upper bounds** to the pins (e.g. `numpy>=2.0,<3`; a tested sklearn range) and commit a lockfile so build == runtime.
- Wrap `joblib.load()` so **any** load failure (not just a missing file) triggers `train_model()` retrain-and-reload — makes the self-heal actually cover the incompatibility case.
- OR commit **version-stamped** model artifacts and refuse to load a bundle whose stamped `sklearn`/`numpy` version doesn't match the runtime (fail loud at boot, not per-request).
- Prefer **train-at-build** with a pinned environment so a `.pkl` and its runtime are never mismatched.

### Baseline note
Does not move the frozen test baseline (API 1388 · ai-service 452 · web 24 · mobile 208 · Playwright 7/23) — this is a latent-runtime finding, no test currently exercises a cross-version load.
