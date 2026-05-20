# Sentry — Activation Runbook

> **Critical for production observability.** No DSN, no error reports —
> every server-side crash, payment-webhook failure, and AI-service exception
> goes to /dev/null.

---

## What it does in vivahOS

- **Error capture** — unhandled exceptions in the API, web app, and Python AI
  service. Web includes Server Actions, Route Handlers, RSC, and client
  bundles.
- **Release-tagged stack traces** — production minified frames mapped back to
  source via uploaded source maps (web only; the Sentry webpack plugin runs
  during `next build` when the secret trio is present).
- **Performance traces** — 10 % sample by default (`SENTRY_TRACES_SAMPLE_RATE`).
- **Verification endpoint** — `GET /api/v1/sentry-test` (API), gated behind
  `SENTRY_TEST_ENABLED=true`.

Code references:
- `apps/api/src/lib/sentry.ts` (init from `apps/api/src/index.ts:109`)
- `apps/web/instrumentation.ts` (Next 14+ register hook — loads server/edge configs)
- `apps/web/sentry.{client,server,edge}.config.ts`
- `apps/web/next.config.ts:24-38` (`withSentryConfig` wrapper — auto-uploads source maps)
- `apps/ai-service/src/main.py:39-60` (`sentry_sdk.init`)

---

## Lead time

**~1 hour** end-to-end. No regulatory or partner approvals — self-service
account on sentry.io plus secret provisioning in Vercel + Railway.

---

## What we need

### 1. Sentry account + projects
- [ ] Create org at https://sentry.io/signup (recommended slug: `smart-shaadi`).
- [ ] Create **three projects**:
  - `web` — platform: Next.js
  - `api` — platform: Node.js / Express
  - `ai-service` — platform: Python / FastAPI
- [ ] Copy the DSN from each project's *Settings → Client Keys (DSN)*.
- [ ] Generate an **organization-scoped auth token** at *Settings → Auth Tokens*
      with scope `project:releases` + `org:read` (needed for source-map upload).
      Save it — Sentry shows it once.

### 2. Vercel env vars (web app)
Set these in Vercel → *Project → Settings → Environment Variables*, scope
**Production + Preview**:

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | `<web-project-dsn>` | Client-side SDK init |
| `SENTRY_DSN` | `<web-project-dsn>` | Server-side SDK init (instrumentation.ts) |
| `SENTRY_ENVIRONMENT` | `production` (or `preview` per-env) | Tag |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | 10 % perf-trace sampling |
| `SENTRY_AUTH_TOKEN` | `<org auth token>` | Source-map upload at build time |
| `SENTRY_ORG` | `smart-shaadi` | Source-map upload target |
| `SENTRY_PROJECT` | `web` | Source-map upload target |

**Important:** the `withSentryConfig` wrapper in `apps/web/next.config.ts` only
runs when the **trio** `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`
are all present. If any one is missing, Vercel ships a build with no source
maps — every production stack trace will show minified `chunks/X.js:1:128`
positions. (This is intentional: it avoids Sentry webpack-plugin errors in
preview / fork PRs that don't have the secrets.)

### 3. Railway env vars (API + AI service)
Set in Railway → *Service → Variables* on **each** service (`api` and
`ai-service`):

| Variable | Value |
|---|---|
| `SENTRY_DSN` | `<api-project-dsn>` for the api service, `<ai-service-project-dsn>` for ai-service |
| `SENTRY_ENVIRONMENT` | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` |

Railway re-deploys automatically when env vars change. No build-time secrets
needed for Node/Python — the SDK ships source positions directly without
needing a separate source-map upload step.

### 4. Why not in CI (`.github/workflows/ci.yml`)?
The Sentry source-map upload happens during **Vercel's** build, not GitHub
Actions. The GHA `build` job validates that the code compiles — its output is
discarded. Uploading from GHA would tag source maps to a release identifier
(GitHub SHA) that no deployed artifact references → wasted upload + confused
Sentry releases. Leave the upload to `withSentryConfig` which runs inside the
Vercel build.

---

## Verification

After secrets are set and Vercel/Railway re-deploy:

1. **API** — `curl https://api.smartshaadi.co.in/health` then visit Sentry →
   `api` project → Issues. Should be empty (no errors). Then with
   `SENTRY_TEST_ENABLED=true` temporarily, hit
   `https://api.smartshaadi.co.in/api/v1/sentry-test` → see a forced error
   appear in Sentry within seconds.
2. **Web** — visit `https://smartshaadi.co.in`, open devtools → Network →
   filter "sentry" → see a session-replay/perf-trace beacon. Force an error
   from a Server Action via dev menu (if available) → confirm it lands in
   Sentry's `web` project with **unminified** stack frames (source maps
   working).
3. **AI service** — `curl https://ai.smartshaadi.co.in/health` (or its
   Railway-assigned URL). Trigger any AI endpoint with an obviously malformed
   payload → see exception in Sentry's `ai-service` project.

If web stack frames are minified, the source-map trio is missing in Vercel.
If server-side errors don't appear at all, `apps/web/instrumentation.ts` is
missing or `SENTRY_DSN` (not just `NEXT_PUBLIC_SENTRY_DSN`) is unset.

---

## Cost

Sentry free tier: 5,000 errors/mo + 10,000 perf events/mo across all projects.
At launch traffic, free tier is sufficient. Team plan starts at $26/mo once
errors exceed free quota.
