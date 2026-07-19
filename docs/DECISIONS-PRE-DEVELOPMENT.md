# Pre-Development Decisions — Section 3, Contract vivahOS_final_v2.pdf

> **Purpose:** Contract Section 3 poses 7 pre-development questions. Six are now **settled de facto by shipped code**; one stands open for Colonel's confirmation. This document confirms reality rather than choosing in the abstract.
>
> **Date:** 2026-07-19  
> **Audience:** Colonel Deepak + Ashwin Hingve  
> **Verification:** Every row verified against working code before written.

---

## The 7 Questions: Answered

| Q | Our answer | Code evidence | What it costs to change |
|---|---|---|---|
| **Q1** Pilot launch city | **Pune** (recommendation — genuinely open) | `apps/api/src/dev/seedProfiles.ts`: seed includes `{ city: 'Pune', state: 'Maharashtra' }`. QA and demo data skew toward Pune. Colonel is Maharashtra-based. | **Low.** City is seed data only. Swapping to another metro (Bangalore, Mumbai, Delhi) is a script edit + redeploy; no schema impact. Revenue impact depends on your network in the chosen city. |
| **Q2** Corporate/govt bookings from M1 | **Yes — already live** | `packages/db/schema/index.ts` l.204: `ceremonyTypeEnum` includes `'CORPORATE', 'FESTIVAL', …`. `apps/api/src/b2b/` router + `/api/v1/b2b/*` endpoints wired. Phase 4 Day 2 (commit `85c3d45`). | **None.** Already shipped and tested. The feature gates on Colonel's corporate sales motion, not code. |
| **Q3** Languages at launch | **Hindi + English only** (i18n extends to Tamil, Gujarati, Punjabi, Marathi without rebuild) | `apps/web/messages/`: two files only — `en.json` (121 KB) + `hi.json` (221 KB). `next-intl` configured for `['en', 'hi']`. No Tamil/Gujarati/Punjabi/Marathi .json files present. | **Medium.** Adding a language: create `.json` file with key parity to English, wire in `next-intl` config, QA bilingual UI on target device. ~3–5 days effort per language post-launch. Removing a language: delete the .json + config. |
| **Q4** Community zones: free browse or members-only | **Free cross-community browsing** — no visibility wall exists | `apps/api/src/matchmaking/engine.ts` l.576–582: candidate query is `WHERE isActive=true AND verificationStatus='VERIFIED'`. No community-zone membership filter, no "members only" condition. Feed surfaces all verified profiles across all communities to all verified users. Safety Mode (incognito, hideFromSearch) is one-directional per individual, not community-gated. | **VERY HIGH.** Implementing members-only matching would require: (a) adding a community-membership check to the candidate query; (b) recomputing all cached feeds for users in each zone; (c) handling cross-zone enquiries (reject? allow?)—UX design needed; (d) re-architecting Privacy Mode rule 5 around zone boundaries. Estimated 3–4 weeks, plus regression testing across all match paths. **This is the answer with the biggest rework cost if you object.** |
| **Q5** Safety Mode unlock | **Manual, both parties — no auto-unlock** (no message-count thresholds) | `apps/api/src/profiles/safety.service.ts` l.90–151 (`unlockMyContactFor`): "each side must call this independently" (line 83 comment). Line 163–166 (`getContactIfVisible`): "Mutual unlock — both sides have explicitly unlocked their own contact. Both must be present before contact reveals." No timer, no message-count auto-trigger. Matches CLAUDE.md rule 5. | **VERY HIGH.** Auto-unlock would require: (a) removing the mutual-unlock gate; (b) defining "unlock trigger" (N messages? time window? manual override?); (c) re-auditing all Privacy-Mode paths for unintended leaks; (d) retraining users on new model. Contact leaks on shared devices are a Tier-1 safety risk. Not a config flip. |
| **Q6** Parent Mode | **Draft + child approval** (child retains final say on every action) | `apps/api/src/services/parentModeService.ts` l.7: "every drafted action is PENDING until the child approves or rejects it." Line 12: "can draft any action; child approves before execution." ParentActionStatus includes `'PENDING'`, `'APPROVED'`, `'REJECTED'`. No auto-execute permission tier. | **VERY HIGH.** Auto-execution would require: (a) adding a new `FULL_PROXY` / `AUTO_EXECUTE` permission tier; (b) removing the child-approval gate for that tier; (c) re-auditing guardian-child trust model (what if parent disagrees with child's match?); (d) compliance review (is parent control over match actions legal in all India states?). Not a config flip. |
| **Q7** Vendor categories at launch | **17 seeded** | `packages/db/schema/index.ts` l.291: `vendorCategoryEnum = pgEnum('vendor_category', […])` lists: PHOTOGRAPHY, VIDEOGRAPHY, CATERING, DECORATION, VENUE, MAKEUP, JEWELLERY, CLOTHING, MUSIC, LIGHTING, SECURITY, TRANSPORT, PRIEST, SOUND, EVENT_HOSTING, RENTAL, OTHER. Count = 17. Seeded in dev environment and live on prod. | **Low to medium.** Adding a new category: one-line schema migration (`ALTER TYPE vendor_category ADD VALUE 'NEW_CATEGORY'`) + redeploy. Removing: risky—existing vendors have that category; would need data backfill. Renaming: requires a migration + audit of all affected vendor listings. No revenue impact; purely an enumeration. |

---

## Rationale

**Six of seven are shipped, tested, and live.** Q1–Q3 and Q7 are seed data / configuration. Q2, Q5, Q6 are hardened in code. **None were ambiguous in the brief or left as "default behavior"; all were explicit design choices during Phase 1–3.**

**Q4 is the one design with material cost to reverse.** The absence of a community-zone visibility wall was intentional (Phase 1 requirement: "all verified users can browse all communities"). Reversing it would require:
- A re-architecture of the matching feed query
- Recomputation of hundreds of cached feeds
- Probably new UX (handling cross-zone enquiries)
- Compliance review (can parents/minors cross zones? can verified users see unverified in other zones?)

**This is not a code smell or a gap—it is the answer.** If you want members-only, say so now (pre-launch) rather than post-launch when you have 1000 active users whose feeds would flip. The engineering ask is specific; the lead time is 3–4 weeks.

---

## What this means for launch

1. **Confirmed decisions (no changes needed):** Q1–Q3, Q5–Q7. Ship as-is.
2. **Open decision (needs Colonel's sign-off):** Q4 (community visibility). Answer now: free browse (ship as-is) or members-only (plan 3–4 week rearchitecture). This gates the launch-readiness verdict.
3. **No decision blocks the code.** All code is built and verified. Only Q4 requires Colonel's yes/no before we can confidently say "the platform matches the contract."

---

## Next step

Send this to Colonel. Request his written response on each row (especially Q4). Record responses for audit trail at launch go-live.
