# BetterStack Uptime Monitor Setup

Manual setup steps for Ashwin. Free tier covers 10 monitors at 3-min check interval — enough for Phase 4 production launch.

## 1. Sign Up

- Go to https://betterstack.com
- Sign up with `ashwin@dualmindlabs.com`
- Pick **Free tier** (10 monitors, 3-min checks, email alerts)

## 2. Create Monitors

In the BetterStack dashboard → **Monitors** → **Create monitor** for each:

### Monitor 1 — `api-health`
| Field | Value |
|-------|-------|
| Type | HTTP |
| URL | `https://api.smartshaadi.co.in/health` |
| Method | GET |
| Expected status | 200 |
| Expected body contains | `"status":"ok"` |
| Check frequency | 3 min |
| Regions | Mumbai, Singapore (closest to ap-south-1) |

### Monitor 2 — `web-homepage`
| Field | Value |
|-------|-------|
| Type | HTTP |
| URL | `https://smartshaadi.co.in` |
| Method | GET |
| Expected status | 200 |
| Check frequency | 3 min |
| Regions | Mumbai, Singapore |

### Monitor 3 — `api-auth-gated`
| Field | Value |
|-------|-------|
| Type | HTTP |
| URL | `https://api.smartshaadi.co.in/api/v1/matchmaking/feed` |
| Method | GET |
| Expected status | **401** |
| Check frequency | 3 min |
| Regions | Mumbai |

> Monitor 3 verifies routing works end-to-end. A 200 here would mean auth is broken; a 5xx means routing/middleware regression. Expecting 401 is the correct invariant for an auth-gated route hit without a token.

## 3. Configure Alerts

Dashboard → **Alerting** → **On-call calendar / Escalation**:

- **Primary channel:** email `ashwin@dualmindlabs.com`
- **Optional secondary:** Slack webhook (add a `#alerts` channel in workspace, paste incoming webhook URL)
- **Optional tertiary:** Telegram bot
- **Cooldown between alerts:** 5 minutes (prevents flap-spam)
- **Resolved notifications:** ON (so you know when it recovers)

## 4. Status Page (Optional)

Dashboard → **Status pages** → **Create**:

- Subdomain: `status.smartshaadi.co.in` (add CNAME → `statuspage.betterstack.com` in Cloudflare)
- Add all 3 monitors
- Public visibility (no password)
- Branding: upload Smart Shaadi logo, set primary color to `#7B2D42` (Royal Burgundy)

## 5. Verification

Once monitors are live:

- All 3 should turn **green** within 6 minutes (2 check cycles)
- Trigger a deliberate failure to test alerting: temporarily set `api-health` expected body to `"status":"NEVER_MATCHES"` → wait 6 min → confirm email lands → revert
- Confirm status-page subdomain resolves and shows live status

## Notes

- BetterStack free tier does not include log management or incident.io integration. If we exceed 10 monitors or need on-call rotation, upgrade to Team ($29/mo).
- For deeper observability (traces, metrics) Sentry (already wired in Phase 4 Day 2) covers the application-layer. BetterStack is purely synthetic uptime probing.
