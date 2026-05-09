# Smart Shaadi · 15-20 Min Demo Runbook · FINAL

> Single-page paste-ready runbook for the live demo to Colonel Deepak.
> Strict 7-part flow: Landing → Auth → Profile → Match → Chat → Vendor + Wedding → Close.

## T-15 Prep (do this BEFORE the demo joins)

1. **Reset clean state** — `pnpm db:reseed` (~60-90s; rebuilds full demo dataset)
2. **Boot apps**
   - API (`port 4000`):  `pnpm --filter @smartshaadi/api dev &`
   - Web (`port 3000`):  `pnpm --filter @smartshaadi/web dev &`
3. **Health checks**
   - `curl -sS http://localhost:4000/health`  → `{ok: true}`
   - `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000`  → `200`
4. **Confirm Demo Mode**
   - Visit `/` — gold floating pill bottom-right reads `DEMO MODE · OTP 123456 · Card 4111 1111`
   - Sidebar nav (when logged in) does NOT show: Store · Rentals · Admin · Vendor Dashboard
5. **Open 4 browser tabs** (Chrome incognito recommended)
   - **T1** — `localhost:3000` (logged out — landing demo + fresh signup)
   - **T2** — `localhost:3000/dashboard` logged in as **Priya Khanna** (`+918888880001` · OTP `123456`)
   - **T3** — `localhost:3000/dashboard` logged in as **Arjun Malhotra** (`+918888880002` · OTP `123456`)
   - **T4** — `localhost:3000/vendor-dashboard` logged in as **Royal Decor** (`+918888880005` · OTP `123456`)
6. **Hide everything else**
   - All other browser tabs closed
   - Notifications silenced (DnD, phone on silent)
   - Slack/email closed

---

## Minute 0–2 · Vision + Landing (T1)

- Open T1; let the hero photography land. Pause 3 seconds.
- Read headline aloud: *"Where families find their forever."*
- Slow scroll through pillars → ceremonies band → vendors preview → testimonials.
- Click **"Start your journey"** → land on `/login`
- **Say:** *"The vision is a complete marriage-centric ecosystem — matchmaking, planning, vendors, and AI workflows landing in phases."*
- **Don't:** deep-dive features yet.

## Minute 2–4 · Auth + Roles (T1 → T2)

- On `/login`: enter `+918888880001` (Priya).
- OTP `123456` → submitted.
- Land on dashboard.
- **Say:** *"The same auth flow handles Individuals, Family Members, Vendors, Coordinators, Admins — phone-based OTP, KYC-aware, 2FA-ready."*
- **Don't:** deep-dive role permissions.

## Minute 4–7 · Profile + Safety Mode (T2 — Priya)

- Open Profile → walk tabs: Personal · Family · Career · Lifestyle · Horoscope.
- Show photos with gold border, partner preferences, profile completeness 92%.
- Show **Safety Mode toggle ON**.
- Open Arjun's profile from match feed → point to phone + email **hidden** badge.
- **Say:** *"Contact details remain protected by Safety Mode until both sides are comfortable. KYC status, horoscope, and Safety Mode are first-class — not afterthoughts."*

## Minute 7–11 · Match flow (T2 → T3)

- `/matches` → 12 candidate cards visible, varied Guna scores, reciprocal-only filter on.
- Click **Arjun** → 28/36 Guna shown; expand 8-koot breakdown.
- Show "Match Accepted 7 days ago".
- Open requests inbox → 2 PENDING, 1 SENT outgoing.
- **Say:** *"Reciprocal — both sides must pass each other's filters before either profile surfaces. Privacy-first by design."*

## Minute 11–14 · Chat (T2 + T3)

- Click chat with Arjun → 12 messages over 5 days visible.
- Type a new message in T2 → switch T3 → message arrives in real-time.
- Point to the **one Hindi message** in the conversation.
- Hover the translation toggle → tooltip reads *"Hindi-English translation — preview (full integration in next phase)"*.
- **Say:** *"AI-assisted conversation and compatibility features integrate phase by phase — Phase 3 ships the full AI Intelligence Layer."*
- **Don't:** oversell AI.

## Minute 14–18 · Vendor + Wedding (T2 + T4)

- `/vendors` → filter Delhi + Decoration → **Royal Decor** card.
- Click Royal Decor → portfolio gallery (4 images), 3 services with pricing, 3 reviews, verified badge.
- Switch **T4** → vendor dashboard with active bookings.
- Switch back **T2** → My Wedding → **Priya × Arjun, December 2026**.
- Show:
  - Countdown to **5 Dec 2026**
  - **7 ceremonies** (Roka + Engagement done · Haldi · Mehendi · Sangeet · Wedding · Reception)
  - Budget donut (₹25L total · ~₹6.2L spent · ₹18.8L remaining)
  - Task progress (12 done · 6 in progress · 11 pending · 1 overdue)
  - 50 guests · 30 yes / 8 no / 6 maybe / 6 pending
- **Don't navigate to:** Escrow / Payments tabs (hidden) · Store · Rentals · Admin (all hidden by demo flag).

## Minute 18–20 · Close strong

- **Say:** *"Right now the focus is stabilising the core flows phase by phase. The architecture supports the full roadmap — AI Intelligence Layer, Vendor Utilization Engine, Mobile, NRI."*
- Hand the WhatsApp summary (`docs/CLIENT-WHATSAPP-SUMMARY.md`).
- Schedule the next sync.

---

## Recovery Cheats

| Stutter | Fix |
|---|---|
| OTP doesn't arrive | Use **T2** (already logged in as Priya) — say *"we have a pre-loaded session for time"* |
| Match feed slow | Refresh; Redis cache populates after first hit |
| Chat won't send | Refresh tab; Socket.io reconnects |
| Page errors | *"Let me note that for after the demo"* — move on |
| Photos broken on landing | Don't dwell; scroll past hero faster |
| API not responding | `curl localhost:4000/health` — restart with `pnpm exec tsx src/index.ts` (tsx watch dies on /mnt/d) |

## Tab Cheat Sheet

- **T1** = Landing/login (start, ~2 min)
- **T2** = Priya Khanna (~12 min — primary thread)
- **T3** = Arjun Malhotra (~3 min — chat real-time + match accept)
- **T4** = Royal Decor vendor (~30 sec at minute 15)

## Don'ts

- **Don't apologise** for rough edges — state them, move on.
- **Don't let the Colonel click** — you drive every transition.
- **Don't go off-script** into hidden routes.
- **Don't oversell AI** — that's Phase 3.
- **Don't show real INR** like ₹150,000 — the seed has Indian-locale grouping `₹1,50,000`.
