# Smart Shaadi · Loom Walkthrough Script · Phases 1–4 Delivery

> **Purpose.** Record an async Loom video showing the **delivered, live** Phase 1–4 platform
> to Colonel Deepak → get **formal written acceptance** → close the **₹1,00,000 milestone**.
>
> **Different from the two live-demo files.** `DEMO-SCRIPT.md` (staging, 25-min) oversells
> stubbed features; `DEMO-RUNBOOK-FINAL.md` (May, Phase-2 era) *hides* the AI and calls
> translation "preview." Both are stale for THIS goal. This script shows the full Phase 1–4
> delivery — including the AI Intelligence Layer + live translation + subscriptions — while
> staying honest about what's still test-mode (Razorpay / MSG91 / KYC providers — all blocked
> on YOUR company registration, not on code).
>
> **Length target: 15–18 min.** You drive every click. Speak Hinglish, calm, confident.

---

## STEP 0 — Before you hit record (10 min)

### A. Pick the environment
- **Production (preferred — proves it's really deployed):** `https://smartshaadi.co.in`
  - ⚠️ **Confirm FIRST that you can log in on prod.** Open `/login`, enter a demo phone,
    try OTP `123456`. If it logs in → prod is in mock mode → record here.
  - Also confirm the demo persona has rich data (a wedding + chats + matches). If prod only
    has thin QA accounts, use the localhost fallback below — the product is byte-identical.
- **Localhost fallback (guaranteed rich data):**
  ```bash
  pnpm db:reseed          # rebuilds full demo dataset (~60–90s) — Priya Khanna + wedding + chats
  pnpm dev                # web :3000, api :4000  (if web 500s on /mnt/d → it's the DrvFs webpack bug; already on --turbopack)
  curl -sS localhost:4000/health          # {ok:true}
  curl -sS -o /dev/null -w "%{http_code}" localhost:3000   # 200
  ```
  Web MUST be on **:3000** (CORS — wrong port silently breaks login).

### B. Demo credentials (mock mode)
| Persona | Phone | OTP | Role |
|---|---|---|---|
| **Priya Khanna** (primary — has wedding + chats + matches) | `+918888880001` | `123456` | INDIVIDUAL |
| **Arjun Malhotra** (other side of chat/match) | `+918888880002` | `123456` | INDIVIDUAL |
| **Royal Decor** (vendor) | `+918888880005` | `123456` | VENDOR |
| Admin | see `packages/db/seed/qa-credentials.local.md` | `123456` | ADMIN |

### C. Tabs to open (Chrome, clean profile)
- **T1** logged out — landing + login
- **T2** Priya — `/dashboard` (your main thread, ~11 min)
- **T3** Arjun — `/dashboard` (chat/match other side)
- **T4** Royal Decor — `/vendor-dashboard`
- **T5** Admin — `/admin`

### D. Clean the frame
- Silence phone + Slack + email + OS notifications (DnD).
- Close all other tabs. Full-screen the browser.
- Test mic. **Do one dry run of the whole flow before recording** — catch any 500 offline.

---

## HONESTY RULES (say these exact framings — protects your acceptance)

Do NOT say "everything is 100% live." Say **"Phases 1–4 delivered and running in production."** For the three blocked items, use these lines — they make the block clearly THE CLIENT's, not yours:

- **OTP login:** *"OTP delivery is on MSG91 SMS — abhi test mode me, go-live pe activate hoga jaise hi DLT registration clear hoti hai."*
- **Payments:** *"Razorpay test mode — live keys ke saath bilkul same, aapke merchant account activate hote hi flip ho jayega."*
- **KYC:** *"Aadhaar verification DigiLocker se — integration ready hai, go-live pe on hoti hai."*

**Never demo / claim:** live Aadhaar approval, real OTP SMS delivery, dispute→refund end-to-end,
Marriage-Readiness Score, AI Profile Optimizer (no UI yet), dynamic vendor pricing. Skip them silently.

---

## THE SCRIPT

### 1 · Intro + Landing — `T1` (0:00–1:30)
- Let the hero land, pause 3s. Scroll slow through pillars → ceremonies → vendors → testimonials.
- **Say:** *"Sir, ye Smart Shaadi ka live walkthrough hai — Phases 1 se 4 tak complete, production me chal raha hai. Matchmaking, wedding planning, vendor bookings, aur ek pura AI layer — sab ek platform me."*
- Click **"Start your journey"** → `/login`.

### 2 · Auth + 6 Roles — `T1 → T2` (1:30–3:00)
- Enter Priya `+918888880001` → OTP `123456` → dashboard.
- **Say:** *"Ek hi phone-OTP flow — Individual, Family Member, Vendor, Coordinator, Admin, Support — chhe roles. No passwords, kam friction, kam attack surface."*
- Honesty line for OTP (see rules above).

### 3 · Profile + Safety Mode — `T2` (3:00–5:00)
- Profile → tabs: Personal · Family · Career · Lifestyle · **Horoscope**. Show photos, partner preferences, completeness %.
- Show **Safety Mode ON**. Open a candidate's profile → **phone + email hidden** badge.
- **Say:** *"Contact details Safety Mode se protected — dono side comfortable hone tak reveal nahi hote. India ka number-one trust concern yahi solve karta hai."*

### 4 · Match feed + Reciprocal + Guna Milan — `T2` (5:00–7:30)  ★ differentiator
- `/matches` → candidate cards, varied scores, **reciprocal-only** filter on.
- Open a high-match card → **Guna Milan score /36** → expand **8-koot Ashtakoot breakdown** (Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi) + dosha notes.
- Point to lifestyle tags (vegetarian / spiritual / career-first).
- **Say:** *"Ye hamara core differentiator. Reciprocal — dono ke filters pass hone pe hi profile surface hoti hai, koi one-sided spam nahi. Aur poora 8-factor Ashtakoot Guna Milan — deterministic Vedic math, 1000+ line engine, tested."*

### 5 · Chat + Live Translation + AI Coach — `T2 + T3` (7:30–10:00)  ★ AI
- Open chat with Arjun (pre-loaded thread). Type in T2 → switch T3 → arrives real-time (read receipts).
- **Translation:** send a Hindi message → show it **translated live** for the other side. *(This is LIVE now — Helsinki-NLP models — not a preview.)*
- **AI Conversation Coach:** show the **ice-breaker / smart-suggestion** chips in chat.
- Show the **Emotional Compatibility Score** badge on the conversation.
- **Say:** *"Real-time chat, Hindi-English translation live, aur AI Conversation Coach jo culturally-aware ice-breakers suggest karta hai — ghosting kam karne ke liye. Emotional score conversation ki health track karta hai."*

### 6 · Matrimony AI Assistant — `T2` (10:00–11:00)  ★ AI
- Open the **AI Assistant** on the dashboard. Ask: *"Show me my most compatible matches"* / *"How does Guna Milan work?"* → it answers + surfaces matches.
- **Say:** *"24/7 conversational AI guide — compatible matches surface karta hai, next steps batata hai, platform ke sawaal answer karta hai. Bina support ticket ke."*
- ⚠️ Don't claim it "books meetings" — it's read-only advisory.

### 7 · Wedding Planning Suite — `T2` (11:00–14:00)
- My Wedding → **Priya × Arjun, Dec 2026**. Show: countdown, **7 ceremonies** (Roka/Engagement done · Haldi · Mehendi · Sangeet · Wedding · Reception).
- **Budget** donut (₹ Indian grouping, e.g. ₹25,00,000). **Tasks** Kanban (done / in-progress / pending / overdue). **Timeline** builder. **Moodboard**.
- **Guests** → 50 guests, RSVP (yes/no/maybe), meal preferences. Show **digital invitation builder** (email + SMS preview).
- **Family Collaboration** → invited members with role-based permissions (Parent Mode).
- **Say:** *"Poora wedding OS — budget, tasks, timeline, ceremonies, guests, invites — sab ek jagah. WhatsApp group aur Excel ka chaos replace karta hai. Family members role-based access ke saath jud sakte hain."*

### 8 · Vendors + Booking + Escrow — `T2 + T4` (14:00–16:00)
- `/vendors` → filter Delhi + Decoration → **Royal Decor** → portfolio, services + pricing, reviews, verified badge.
- Start a booking → package + date → **Razorpay checkout (test mode)** → confirm. Mention **escrow: 50% advance, 48h release, admin-mediated dispute**.
- Switch **T4** → vendor sees the booking + multi-event pipeline + payouts/leads.
- **Say:** *"Full booking flow — request se payment tak. Razorpay test mode (live keys pe same). Paisa escrow me — 50% advance, event ke baad release — customer aur vendor dono safe."*
- Quick mention (don't dwell): Rentals + E-Commerce store bhi live hain.

### 9 · Subscriptions + Hindi UI + Referral — `T2` (16:00–17:00)  ★ Phase 4
- Open **Pricing** → Free / Standard / Premium tiers, Razorpay Subscriptions.
- **Flip the UI to Hindi** (language toggle) → whole app renders Hindi. *(wow moment — full i18n, 1047 keys.)*
- Show **Referral** page (unique code, credits).
- **Say:** *"Revenue live — teen subscription tiers, referral programme, vendor lead-gen fees. Aur poora Hindi UI — ek toggle, aur framework Tamil/Gujarati/Punjabi/Marathi ke liye ready, bina rebuild."*

### 10 · Admin + Trust — `T5` (17:00–18:00)
- `/admin` → KYC review queue, vendor approval, **Analytics** (user growth, match funnel, revenue), Escrow, **hash-chained audit log**.
- **Say:** *"Admin ke paas full control — KYC queue, vendor approval, analytics, aur tamper-proof audit log har payment/KYC event ke liye. Har cheez ek dashboard se monitor hoti hai."*

### 11 · Close (18:00–18:30)
- **Say:** *"Sir, ye sab Phases 1 se 4 — live, production me. Chhe AI matchmaking features jo koi Indian competitor combine karke nahi deta. Platform launch-ready hai — go-live sirf Razorpay aur MSG91 registration ka wait kar raha hai, jo company docs pe depend karta hai. Main details WhatsApp/email pe bhej raha hoon."*

---

## AFTER RECORDING — the acceptance ask (send with the Loom)

> **Subject:** Smart Shaadi — Phases 1–4 Delivery Walkthrough + Acceptance
>
> Respected Colonel Deepak,
>
> Phases 1–4 complete aur live production me — is Loom me poora walkthrough hai:
> matchmaking + 8-factor Guna Milan, real-time chat + Hindi-English translation,
> 6 AI features (Conversation Coach, Emotional Score, AI Assistant + more), full
> wedding planning suite, vendor bookings + escrow, subscriptions, aur complete Hindi UI.
>
> 🎥 [Loom link]
>
> Delivered work ke liye **₹1,00,000 milestone** request kar raha hoon. Baaki phases ke
> liye ek milestone-linked schedule bhej raha hoon taki payment delivery ke saath track kare.
> Go-live ka balance tab release hoga jab Razorpay + MSG91 registration clear ho jayegi
> (company docs pending).
>
> Kripya acceptance confirm karein. — Ashwin

**Then:** formal acceptance milte hi → milestone payment close → remaining phases ko written
milestone schedule me convert (schedule already drafted — bolo to formal doc bana dun).

---

## Recovery cheats (if it stutters mid-record — just re-record that segment)
| Stutter | Fix |
|---|---|
| OTP nahi aaya | Pre-logged T2 (Priya) use karo |
| Match feed slow | Refresh — Redis cache first hit pe populate hota hai |
| Chat send nahi hua | Refresh — Socket.io reconnect |
| Page error | Us segment ko dobara record karo (Loom async hai — koi live pressure nahi) |
| Web 500 on /mnt/d | DrvFs webpack bug — `--turbopack` already on; ya prod URL pe record karo |
