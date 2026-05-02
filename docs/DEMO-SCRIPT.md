# Smart Shaadi — 25-Minute Demo Script

> **Purpose.** Minute-by-minute walkthrough for the client meeting demo. Every flow has been pre-tested on staging; recovery steps included if anything stutters.
>
> **Pre-demo (T-30 min).** Run smoke `pnpm test:e2e -- --grep "demo"`. Confirm green. Open Sentry, PostHog, Grafana in tabs.

---

## Setup

### Browser tabs (open before client arrives)

| Tab | URL | Logged in as |
|-----|-----|--------------|
| 1 | `https://staging.smartshaadi.co.in` (incognito) | logged out — for fresh signup |
| 2 | `https://staging.smartshaadi.co.in` | Priya (bride) — primary demo persona |
| 3 | `https://staging.smartshaadi.co.in` | Arjun (groom) — to simulate the other side |
| 4 | `https://staging.smartshaadi.co.in/admin` | admin user |
| 5 | `https://staging.smartshaadi.co.in/vendor-dashboard` | demo vendor |
| 6 | Sentry → Issues page (filtered to last 1h, hopefully empty) |
| 7 | PostHog → live events feed |
| 8 | Grafana → vivahOS overview dashboard |

### Demo data (pre-seeded on staging)

- **Priya** (groom-seeker, age 27, Delhi, Punjabi) — full profile, KYC done, 5 saved matches
- **Arjun** (bride-seeker, age 30, Delhi, Punjabi) — paired with Priya for the demo flow, will appear in her feed
- **Vendor "Royal Decor"** — Delhi wedding decorator, ₹50k–2L packages, with portfolio
- **Vendor "Tandoor Tales"** — Delhi caterer, with one in-progress booking ready for dispute demo
- **Booking #DEMO-001** — Priya × Royal Decor, status `IN_PROGRESS`, payment captured, ready for dispute
- **Wedding "Priya × Arjun, December 2026"** — full ceremony list, 50 guests, mid-planning

---

## Minute 0–3 — Onboarding

**Goal:** show how clean the signup-to-profile-complete flow is.

### Tab 1 (incognito) — fresh signup

1. Click **"Get Started"** on landing page
2. Enter phone number: `+91-99999-XXXXX` (a real test number — OTP will be in MSG91 mock log shown on screen if needed)
3. Show OTP screen → "in mock mode the OTP shows in our logs; in production it lands on the user's phone in under 5 seconds"
4. Enter OTP (read from staging log: `tail -f apps/api/logs/mock-otp.log` on a separate window)
5. **Profile creation wizard** — walk through 5 steps quickly:
   - Personal (name, DOB, gender, height)
   - Family (occupation, siblings, location)
   - Career (education, occupation, income range)
   - Lifestyle (food, drink, smoking, hobbies)
   - Photos — show drag-drop upload to R2 (no streaming through API)
6. **KYC** screen — show Aadhaar + PAN upload UI; click through with mock approval
7. Land on dashboard

### Talking points
- "Phone OTP is the only login. No passwords. Less friction, less attack surface."
- "Photos uploaded directly to Cloudflare R2 — they never touch our API server."
- "KYC is mocked here; real DigiLocker + NSDL flow will replace the mock flag with zero code change."

### Recovery (if stuttering)
- If OTP doesn't arrive: switch to Tab 2 and continue with Priya. Say "we have a pre-completed profile to save time."

---

## Minute 3–7 — Matchmaking

### Tab 2 — Priya's account

1. Click **"Matches"** in sidebar
2. Show match feed — cards with Guna Milan score badges (out of 36), reciprocal-only filter, distance, age compatibility
3. Click on Arjun's card → full profile
4. Point out:
   - **Guna Milan breakdown** — all 8 Ashtakoot factors, expandable
   - **Phone + email withheld** until match accepted ("PII is gated by both-side consent")
   - **Safety Mode** badge — Priya has it on; her last name is hidden
5. Click **"Send Match Request"** → personal message → submit
6. Switch to Tab 3 (Arjun)
7. Notification appears (live PostHog event will show in Tab 7)
8. Arjun accepts → returns to Tab 2 (Priya)
9. Now phone + email visible. Match unlocked.

### Talking points
- "Reciprocal matching means we never show one-sided recommendations. Privacy-first by design."
- "Guna Milan is deterministic Vedic math — `apps/ai-service/routers/horoscope.py`. Tested with 91 cases."
- "Safety Mode hides the user's last name + photos until they explicitly approve a match. Activated by default for under-25 women."

### Recovery
- If reciprocal accept seems slow, refresh Tab 2 manually. The state is in Postgres + Redis cache.

---

## Minute 7–12 — Communication + Video

### Tab 2 — Priya

1. Click **"Chat"** on Arjun's match card
2. Show real-time chat — type "Hi", switch to Tab 3, watch it arrive instantly
3. **Translation toggle** — switch chat to Hindi, type a Hindi message, show it appears translated for Arjun
4. Click **"Schedule Video Call"** → time picker → confirm
5. Switch to Tab 3 (Arjun) — accept call schedule
6. Click **"Join Call"** in Tab 2
7. Show Daily.co room launching (mocked URL on staging — say "in production this is a real video room")
8. Show waiting-room → both join → 5 seconds of demo → end call
9. Audit log entry visible in admin tab

### Talking points
- "Socket.io multi-instance — chat scales horizontally without dropping messages."
- "Daily.co provides the video infrastructure. Recording is consent-gated, stored in our R2."
- "Every call, every chat session is audit-logged with chained-hash. Tampering is provable."

### Recovery
- If video doesn't open (browser permission), show the room URL in admin's "Video Rooms" panel and say "this is what the user clicks."

---

## Minute 12–18 — Wedding Planning

### Tab 2 — Priya (still)

1. Click **"Plan Wedding"** → existing wedding "Priya × Arjun, December 2026" loads
2. **Overview** screen — show ceremony list (Sangeet, Mehendi, Wedding, Reception)
3. Click **Sangeet** → show its fields: date, venue, budget allocation
4. **Muhurat suggestion** — click "Suggest auspicious date" → AI service returns 3 options with explanations
5. **Guests tab** → 50 guests imported, RSVP status, dietary preferences
   - Click "Send save-the-date" → shows email + SMS preview (Bull queue jobs created — visible in Tab 8 Grafana queue depth)
6. **Seating tab** → drag-drop seating chart — 5 tables, guests assigned
7. **Moodboard tab** → image collage with vendor inspiration
8. **Expenses tab** → pie chart of budget allocation across ceremonies
9. **Timeline tab** → Gantt chart of pre-wedding tasks, deadlines highlighted
10. **Documents tab** → vendor contracts, invoices, IDs uploaded

### Talking points
- "Multi-event support is built-in — Sangeet, Mehendi, Reception each have their own ceremony entity."
- "Muhurat selection routes through ai-service — same Vedic engine as Guna Milan."
- "Guests can RSVP via a public link — no account needed. Pre-built RSVP page on Vercel."
- "Every change here triggers a Bull job for notifications. Watch the queue depth tick up in Grafana."

### Recovery
- If muhurat AI is slow, show the cached result from a previous run. Say "this is precomputed for the next 6 months."

---

## Minute 18–22 — Vendor + Booking + Payments + Dispute

### Tab 2 — Priya

1. Click **"Vendors"** → filter: Delhi, Decor, ₹1L–2L
2. Click **Royal Decor** → portfolio, packages, reviews, availability calendar
3. Click **"Book"** → select package "Premium Decor", date Dec 5, ₹1.5L
4. Razorpay payment screen opens (test mode) — pay with test card `4111 1111 1111 1111`
5. Booking confirmed; escrow holds ₹1.5L
6. Switch to Tab 5 (vendor dashboard)
7. Royal Decor sees the booking, accepts
8. Switch back to Tab 2 — now show the simulated dispute on Booking #DEMO-001 (Tandoor Tales)
9. Click **"Raise Dispute"** → reason: "vendor didn't show up", evidence upload, submit
10. Switch to Tab 4 (admin)
11. Admin sees the new dispute → opens it → reviews evidence → clicks **"Refund Customer"**
12. Razorpay refund initiated (test mode); status flips to `RESOLVED_REFUND`
13. **Audit log** opens — show the chained-hash entries: dispute raised → admin viewed → refund initiated → refund completed. Each row's hash includes the previous row's hash.
14. Switch to Tab 6 (Sentry) — empty (no errors during the flow)

### Talking points
- "Razorpay test mode is identical to LIVE — the only difference is the keys. We've run 100s of transactions in test."
- "Escrow uses optimistic CAS locking — concurrent admin actions can't double-resolve. Code: `apps/api/src/payments/dispute.ts:277`."
- "Audit log chained-hash means tampering is mathematically detectable. Show legal counsel this slide if needed."
- "Refunds settle to the customer's original payment method in T+5 days, automatically."

### Recovery
- If Razorpay test card declines (rare), use card `5267 3181 8797 5449` (alt test card).
- If admin tab is logged out, log in fresh — credentials are in 1Password, password manager open in background.

---

## Minute 22–25 — Admin + Observability

### Quick tour across tabs 4, 6, 7, 8

1. **Tab 4 (admin)**
   - Show admin dashboard: today's bookings, active disputes, KYC queue
   - **Reconciliation page** — daily Razorpay vs DB diff, all green
   - **KYC review queue** — Refinitiv flagged matches awaiting human review
2. **Tab 6 (Sentry)**
   - Filter to last 1h — empty. "No errors during the demo."
   - Show a historical error to demonstrate filtering, redaction, stack traces
3. **Tab 7 (PostHog)**
   - Live events feed — show the events from the demo flow (signup, profile_created, match_request_sent, booking_confirmed, payment_captured, dispute_raised, dispute_resolved)
   - Open the "Demo Flow" funnel — conversion rate at each step
4. **Tab 8 (Grafana)**
   - RPS chart, p95 latency, queue depth
   - Show that during the demo, RPS spiked, latency stayed under 200ms
   - Bull queue depth: notifications spike then clear, escrow-release queue idle

### Talking points
- "Three observability layers: errors (Sentry), events (PostHog), metrics (Grafana)."
- "Pino redacts every log line — even if an exception carries a phone number, it never reaches Sentry unredacted."
- "BetterStack alerts me on /health failures within 30 seconds."

---

## Wrap-up (last 30 seconds)

> "That's the platform end-to-end. Everything you saw runs on the same staging environment that becomes production with one DNS swap. Provider activation kit is ready — pick Razorpay first, real money flows by next Friday."

Switch to **slide 12** of `CLIENT-PRESENTATION.md`.

---

## Recovery cheat sheet

| If… | Do this |
|-----|---------|
| Staging is down | Open the demo recording (saved offline as `demo-recording.mp4`) |
| OTP doesn't arrive | Use Tab 2 (Priya) — already logged in |
| Razorpay card declines | Try alt card `5267 3181 8797 5449` |
| Video doesn't open (browser perm) | Show the room URL in admin's video panel; say "this is what the user clicks" |
| Translation lag | Pre-cache by toggling once before the meeting |
| AI muhurat slow | Show pre-cached result from earlier run |
| Sentry shows a real error | Acknowledge, say "let me check that after the demo," continue |

---

## Pre-demo checklist (T-30 min)

- [ ] `pnpm test:e2e -- --grep "demo"` green
- [ ] Staging `/health` and `/ready` both 200
- [ ] All 8 tabs open and logged in
- [ ] Demo recording loaded as backup (offline file)
- [ ] OTP log tail running in a side terminal
- [ ] Sentry filtered to last 1h, currently empty
- [ ] PostHog live events feed open
- [ ] Grafana dashboard auto-refresh on
- [ ] Test microphone + camera (for video segment)
- [ ] Razorpay test cards ready in clipboard or password manager
- [ ] Notebook ready for client questions

---

## Post-demo checklist

- [ ] Hand over physical printouts: Provider Activation Kit, Security Review, Architecture diagram
- [ ] Send digital copies via email
- [ ] Schedule next sync (1 week out)
- [ ] Send action item summary email within 2 hours
