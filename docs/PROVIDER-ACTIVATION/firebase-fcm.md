# Firebase Cloud Messaging — Activation Runbook

---

## What it does in vivahOS

Push notifications:
- Match request received
- Booking confirmed
- Payment captured
- Dispute updates
- Wedding reminders, RSVP nudges
- Vendor inquiries (vendor-side)

Code reference: `apps/api/src/notifications/providers/fcm.ts`.

---

## Lead time

**1 day.** Self-serve.

---

## What we need from the client

### Project
- [ ] Firebase project at https://console.firebase.google.com
- [ ] Project name: `smart-shaadi-prod`
- [ ] Enable Cloud Messaging

### iOS (when mobile app ships in Phase 7 — defer for now)
- Apple Push Notification certificate
- APN key + key ID

### Android
- [ ] Add Android app: package name `com.smartshaadi.app` (Phase 7 placeholder; web push works without)

### Web push (active in v1)
- [ ] Generate VAPID key pair in Firebase console
- [ ] Public VAPID key → `NEXT_PUBLIC_FIREBASE_VAPID_PUBLIC` in Vercel
- [ ] Service account JSON → developer

### Hand over to developer
- [ ] **`FIREBASE_SERVICE_ACCOUNT`** (full JSON, store as Railway secret)
- [ ] **`NEXT_PUBLIC_FIREBASE_VAPID_PUBLIC`** (Vercel)
- [ ] Project ID: `smart-shaadi-prod`

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set FIREBASE_SERVICE_ACCOUNT="$(cat firebase-sa.json | base64)"
# Decoded at app boot

# In Vercel:
vercel env add NEXT_PUBLIC_FIREBASE_VAPID_PUBLIC

# 2. Flip mock
railway env set USE_FCM_MOCK=false

# 3. Deploy + smoke
git push origin main
pnpm test:provider:fcm -- --live
# Sends a test push to a developer device; asserts delivery
```

---

## Rollback

```bash
railway env set USE_FCM_MOCK=true
# Pushes log to console; no user-facing impact
```

---

## Cost model

**Free.** Firebase Cloud Messaging is unlimited and free. No paid tier needed for the lifetime of the platform.

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Token expired (user uninstalled app) | FCM returns `NotRegistered` | Auto-purge from `device_tokens` table |
| Quota throttle (very rare) | FCM 429 | Retry with exponential backoff |
| iOS/APN cert expired (Phase 7) | FCM returns `InvalidApnsCredential` | Renew Apple cert |

---

## Critical privacy note

Push payloads should be **minimal**. We send:
- Title + short body
- Deep-link URL
- Notification ID

We do **not** send full message content, profile names, or any PII in the payload (push payloads are visible on lock screens and may be intercepted by OS-level analytics). The user opens the app to see the full content.

---

## Why this is fast

Self-serve, free, no review. The only gate is creating the Firebase project + sharing the service account JSON securely.
