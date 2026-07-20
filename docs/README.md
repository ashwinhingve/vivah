# Smart Shaadi — Documentation Index

> Start here. Living docs only — historical records are in [`archive/`](./archive/).
> Last reorganized: 2026-07-21.

## Quick start

| Doc | What it covers |
|-----|----------------|
| [SETUP.md](./SETUP.md) | Local dev environment (Node, Python, Docker, env files) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram + service responsibilities |
| [API.md](./API.md) | REST endpoint reference |
| [DATABASE.md](./DATABASE.md) | Postgres/Mongo/Redis schema glossary |

## Launch & operations

| Doc | What it covers |
|-----|----------------|
| [ACTION-TRACKER.md](./ACTION-TRACKER.md) | Launch-readiness task tracker (source of truth) |
| [launch/](./launch/) | Go-live kit: checklist, runbook, first-24h monitoring, mock→real swap, DR replay |
| [handover/HANDOVER-INDEX.md](./handover/HANDOVER-INDEX.md) | Operator handover entry point (env matrix, SLOs, scaling, indexes) |
| [RUNBOOK.md](./RUNBOOK.md) | Incident response procedures |
| [MIGRATIONS-PENDING.md](./MIGRATIONS-PENDING.md) | Hand-vetted pending prod migrations |
| [db/journal-drift.md](./db/journal-drift.md) | ⚠️ Active blocker: migration ledger drift — reconcile before next `db:generate` |
| [monitoring/betterstack-setup.md](./monitoring/betterstack-setup.md) | Uptime monitor setup |
| [PROVIDER-ACTIVATION/](./PROVIDER-ACTIVATION/) | Per-provider go-live runbooks (Razorpay, MSG91, KYC stack, …) |

## Domain reference

| Doc | What it covers |
|-----|----------------|
| [adr/](./adr/) | Architecture Decision Records (pricing model, cross-origin cookies/CORS) |
| [GUNA-ORDERING.md](./GUNA-ORDERING.md) | Guna Milan gender-ordering rule |
| [calendar-muhurat-conventions.md](./calendar-muhurat-conventions.md) | Muhurat panchang authority decisions |
| [PWA.md](./PWA.md) | PWA manifest, service worker, caching security |
| [DECISIONS-PRE-DEVELOPMENT.md](./DECISIONS-PRE-DEVELOPMENT.md) | Pre-development contract decisions (Q1–Q7) |

## Demo

| Doc | What it covers |
|-----|----------------|
| [DEMO-RUNBOOK-FINAL.md](./DEMO-RUNBOOK-FINAL.md) | Live demo operator runbook (15–20 min) |
| [LOOM-WALKTHROUGH.md](./LOOM-WALKTHROUGH.md) | Async Loom video script |
| [demo/demo-data-plan.md](./demo/demo-data-plan.md) | Hand-crafted demo profiles (mirrored in `scripts/seed-demo-data.config.ts`) |
| [demo/DEMO-DATA.md](./demo/DEMO-DATA.md) | Deterministic demo dataset: generator, loader, segment queries, removal SQL |

## Active work & roadmap

| Doc | What it covers |
|-----|----------------|
| [../ROADMAP.md](../ROADMAP.md) | Current phase, blockers, session log (repo root) |
| [premium-ui/](./premium-ui/) | Premium UI overhaul session docs (branch `feat/premium-ui-phase-1`) |
| [phase-5-8/PHASE-5-8-ROADMAP.md](./phase-5-8/PHASE-5-8-ROADMAP.md) | Phases 5–8 delivery plan |
| [PRODUCT-GAPS.md](./PRODUCT-GAPS.md) | Ranked post-launch feature backlog |
| [UI-OVERHAUL-SUMMARY.md](./UI-OVERHAUL-SUMMARY.md) | Design-system / motion baseline |
| [UI-POLISH-PLAN.md](./UI-POLISH-PLAN.md) | UI polish execution plan (completed 2026-07-15) |
| [ui-consistency-checklist.md](./ui-consistency-checklist.md) | Design-system compliance checklist |

## Audit trail

| Doc | What it covers |
|-----|----------------|
| [PHASE-1-4-AUDIT.md](./PHASE-1-4-AUDIT.md) | 143-item completeness audit + resolution log |
| [SECURITY-REVIEW.md](./SECURITY-REVIEW.md) | Pre-launch security hardening review |
| [phase1-2-code-review.md](./phase1-2-code-review.md) | 137-finding code review + resolution log |
| [audits/](./audits/) | One-time audits (schema drift — superseded, see banner) |

## Archive

[`archive/`](./archive/) — ⚠️ historical reference only: completed implementation plans,
weekly QA snapshots, old demo scripts, client-era decks, sprint session notes.
Do not add new docs there; internal links inside archived files are not maintained.
