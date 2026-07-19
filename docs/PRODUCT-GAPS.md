# Ten things missing that would make Smart Shaadi better

> **Written:** 2026-07-19 · **Author:** engineering (Ashwin + Claude)
> **Status:** proposals for the Colonel and Ashwin to rank. Nothing here is built.
>
> Each was checked against the codebase before being listed — anything that
> already exists (profile-ID lookup, referrals, retention campaigns, NRI
> matching, virtual dates, parent mode, lending/insurance referrals) is
> deliberately **not** here. The platform is feature-rich; these are the gaps
> that remain after eight phases.

Ranked by **value ÷ effort**, most worth doing first.

---

## 1. Regional languages beyond Hindi — Marathi, Tamil, Telugu, Gujarati, Bengali

**Gap:** `apps/web/src/i18n/routing.ts` declares `locales: ['en', 'hi']` only.

**Why it matters more than it looks:** the pilot city is Pune — Marathi is the
home language of most of the market you are launching into, and the current app
asks them to use English or Hindi. Indian matrimony is overwhelmingly
community-and-language segmented; a Marathi-first experience in Pune is a
sharper wedge than any new feature on this list.

**Effort:** the infrastructure is already right — next-intl, a locale-prefixed
route tree, and a fragment/merge workflow (`messages/merge-fragment.mjs`).
Adding a locale is a config line plus translation. The cost is entirely
**human translation**, and it must be human: machine-translated matrimony copy
reads as untrustworthy in exactly the moment trust is being decided.

**Do first:** Marathi only, for the Pune pilot. Do not add five at once.

---

## 2. Downloadable Kundli / compatibility report (PDF)

**Gap:** Guna Milan is implemented (`apps/ai-service/routers/horoscope.py`, all 8
Ashtakoot factors) and FII produces a narrative, but the result only exists
inside the app.

**Why:** in Indian matrimony the horoscope match is the artefact that gets
**shared with parents and the family pandit**. Today a user has to screenshot
it. A branded, printable report is the single strongest organic-distribution
mechanism this product has — it travels to exactly the people who influence the
decision, and it carries the brand into that conversation.

**Effort:** low. The data and the narrative already exist. A print-styled route
plus browser "save as PDF" covers 90% of the value with no new dependency.

---

## 3. Saved searches with alerts

**Gap:** no `savedSearch` / `searchAlert` anywhere in the schema.

**Why:** a user sets filters (community, city, education, age), finds nothing
today, and leaves. Without saved searches there is no reason to come back —
and re-entering filters every visit is the most common quiet churn cause in
matrimony products. This is the cheapest retention mechanism available.

**Effort:** medium. New table + a nightly Bull job diffing new profiles against
saved criteria. Reuses the existing matchmaking filter path and queue
infrastructure. Pairs with #4.

---

## 4. Weekly match digest email

**Gap:** retention campaigns exist (`retention_campaigns`, migration 0033) but
there is no recurring match digest.

**Why:** AWS SES is already wired and Bull queues already run scheduled jobs, so
this is mostly assembly. A weekly "here are 6 people worth looking at" email is
the highest-ROI retention surface in this category, and it is the natural
delivery channel for #3.

**Caveat:** do not ship until `VIEW_QUOTA_ENABLED` behaviour is settled — a
digest that shows profiles the user cannot then view is a bad first impression.

---

## 5. Verified-badge tiers (what "verified" actually means)

**Gap:** `vendors.verified` and profile verification are booleans. There is no
tier and no public explanation.

**Why:** this session found a live case where the badge was actively misleading —
seeded placeholder venues rendered as "Verified". That is now fixed, but the
underlying design issue stands: one boolean is asked to mean phone-verified,
KYC-verified, and manually-reviewed all at once. Make the tiers explicit
(Phone → ID → Manual review), show users what each means, and the badge starts
carrying real information.

**Effort:** low-medium, and it directly serves the trust story the platform sells.

---

## 6. In-chat scam and fraud phrase detection

**Gap:** `chat_reports` exists (reactive), but nothing proactive.

**Why:** matrimony platforms are a known target for advance-fee and romance
fraud, and the victims are disproportionately the users this platform is built
to protect. A user asked to move to WhatsApp and send money in the first three
messages is the classic pattern, and it is detectable.

**Effort:** medium. The AI service already runs XLM-RoBERTa for emotional
scoring; a phrase/pattern classifier fits the existing bundle shape. Start with
a deterministic rule list (payment requests, off-platform migration, urgency) —
it catches most of it without a model, and it is explainable in a dispute.

---

## 7. Success stories

**Gap:** none in schema or routes.

**Why:** two jobs at once — social proof at the exact moment of doubt, and
long-tail SEO. The 22 programmatic SEO routes already built rank for intent
("Marathi brides in Pune"); success stories rank for reassurance ("is Smart
Shaadi real"), which is the other half of the funnel. They also give the Colonel
something to publish while real supply is still being onboarded.

**Effort:** low technically; the real work is collecting consented stories, which
cannot start until there are marriages. **Build the surface early, fill later.**

---

## 8. Instalments for vendor bookings

**Gap:** no `instalment` concept; escrow is single-payment.

**Why:** Indian weddings are paid in tranches — booking advance, milestone, final
settlement. Today the product asks for a model vendors and families do not
actually use, which pushes the real transaction off-platform, and every
off-platform transaction is lost revenue *and* a lost dispute-resolution hook.

**Effort:** high, and it touches escrow and refunds — the two areas with the
least tolerance for bugs. Sequence it well after launch, with tests first
(CLAUDE.md already forbids skipping tests on escrow logic).

---

## 9. Family shortlist collaboration

**Gap:** parent mode exists (`parent_drafted_actions`, family compatibility
ratings), but shortlists are single-user.

**Why:** the decision is rarely made alone. Letting a family shortlist and
comment together matches how the choice is actually made, and it quietly
multiplies engaged accounts per marriage — parents who are inside the product
are parents who do not push the search back to a broker.

**Effort:** medium. Extends `shortlists` plus the existing family-member
relationships rather than inventing a new sharing model.

---

## 10. Vendor calendar sync (Google / Outlook)

**Gap:** `vendor_capacity` and `vendor_blocked_dates` are managed in-app only.

**Why:** vendors do not live in your admin panel. If their real calendar is
elsewhere, availability drifts, and a double-booking caused by stale
availability is the failure most likely to lose a vendor permanently — they
blame the platform, publicly.

**Effort:** medium-high (OAuth + webhook reconciliation). Worth it only once
vendor density is real; before that, an iCal export is 20% of the work for most
of the benefit.

---

## What we would actually do first

If the goal is measurable impact soonest, and the platform is still pre-launch:

1. **#2 Kundli PDF** — smallest build, immediate organic distribution.
2. **#1 Marathi** — decides whether the Pune pilot feels local or imported.
3. **#5 Verified tiers** — cheap, and the trust story is the product.
4. **#3 + #4 together** — the retention loop, but only after the quota decision
   lands.

Everything else waits for real users, because it should be shaped by them
rather than by us guessing.

---

## A note on why none of these are built yet

They are proposals, not work-in-progress. Implementing several unsupervised
immediately before launch would add unverified surface area to a codebase whose
verified state is the thing currently protecting the launch date. This session
already found four defects that every automated gate passed — two crashing
pages, a missing booking guard, and a false "verified" claim. The bar for adding
new code right now should be higher than usual, not lower.
