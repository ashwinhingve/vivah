# Guna Milan is order-sensitive — who is `profile_a` matters

> **Written:** 2026-07-20
> **Status:** the user-facing endpoint is FIXED. The background job is NOT — see below.

## The rule

Guna Milan is not symmetric. Three of the eight factors depend on which chart
is the groom's:

- **Varna (1 pt)** scores when the *boy's* varna rank >= the *girl's*. Reverse
  the inputs and a scoring pair becomes a non-scoring one.
- **Tara (3 pts)** counts nakshatras *girl → boy*.
- **Bhakoot (7 pts)** is evaluated on the relative rashi position, which is
  direction-dependent.

So `guna(A, B)` and `guna(B, A)` can return different totals for the same two
people. `apps/ai-service/GUNA_PLAN.md` states this ("Boy rank >= Girl rank",
"Count from girl→boy"); it is a property of the algorithm, not a bug in it.

## What was wrong in the user-facing endpoint (fixed)

`GET /api/v1/ai/guna/:matchId` originally passed the **requester** as
`profile_a`:

```ts
loadHoroscope(requesterProfileId),   // profile_a
loadHoroscope(otherProfileId),       // profile_b
```

Two separate problems fell out of that:

1. The two people in one match would get **two different scores for the same
   pairing**, depending on which of them opened the page.
2. The cache key is normalised over the sorted profile-id pair
   (`guna:{idA}:{idB}`), so whoever loaded it *first* decided what the other
   one saw. The displayed score became a function of cache state.

Fixed by ordering on gender: the MALE participant is always `profile_a`. When
the pair is not one MALE and one FEMALE (gender missing, `NON_BINARY`, `OTHER`,
or same-gender), no groom/bride ordering exists to apply, so it falls back to
sorting by profile id — still arbitrary with respect to the Vedic rule, but
**stable**, so both parties agree and the shared cache entry stays coherent.
Classical Jyotish simply does not define these cases; one
arbitrary-but-consistent answer beats two inconsistent ones.

### Where gender actually lives — a trap worth knowing

There is **no `gender` column on the Postgres `profiles` table.** The Drizzle
schema declares

```ts
export const genderEnum = pgEnum('gender', ['MALE','FEMALE','NON_BINARY','OTHER']);
```

at `packages/db/schema/index.ts:373` and then **never attaches it to any
table**. So `profiles.gender` reads as entirely plausible while being neither
typed nor present, and the first version of this fix used it. It would have
thrown at request time on every call.

Gender lives in **MongoDB**, at `personal.gender` on the `profiles_content`
document — the same document the horoscope comes from, which is how
`matchmaking/engine.ts` already reads it (`row.personal?.gender`). Reading both
from one document is also one fetch instead of two.

Worth noting how this was caught: not by type-check or lint, but by querying
the local database while setting up a browser check and finding the column
absent. A dangling `pgEnum` is invisible to every automated gate.

Three regression tests cover it, in `apps/api/src/__tests__/ai.guna.test.ts`.
They were **mutation-checked**: reverting the fix makes the female-requester
test fail. An earlier version of these tests passed against the buggy code
because the mocks returned fixtures by call order and so could not tell which
profile had been loaded first — the mocks are now keyed by input instead.

## A second, worse bug: values were never translated (fixed)

The endpoint passed the STORED horoscope value straight to the calculator.
`packages/schemas` validates horoscope writes against UPPERCASE enum values
(`'TULA'`), while `guna_milan.py` keys on Sanskrit spellings (`'Tula'`).

The calculator looks factors up with `dict.get()` and **never raises** on an
unknown key. So an untranslated value did not error — it scored zero. Measured
against the running service on the same pair:

| Sent | Result |
|---|---|
| `Mesha` / `Bharani` (translated) | **15 / 36** |
| `MESH` / `BHARANI` (raw, as stored) | **0 / 36 — "Not recommended"** |

Every real user would have seen 0/36 on every match, silently, with nothing in
the logs. It survived local testing only because seeded data stored Sanskrit —
contradicting the schema the write path enforces.

Both paths now normalise through `apps/api/src/lib/horoscope.ts`, which accepts
either form and returns **null** for anything unrecognised, so a bad value
refuses to render rather than producing a confident wrong verdict. Its test
iterates `RASHI_VALUES` / `NAKSHATRA_VALUES` from `packages/schemas` directly:
adding an enum value without a mapping now fails a test instead of shipping a
zero score.

Seed fixtures were corrected too — `'Various'`, `'Vrischika'` and `'Jyeshta'`
were not valid in either vocabulary.

## The background job (now fixed)

`apps/api/src/jobs/gunaRecalcJob.ts` used to sort the two profile ids
alphabetically and pass them straight through as `profile_a` / `profile_b`.
Deterministic — so it never had the inconsistency bug above — but **not
gender-ordered**, so roughly half of all pairs were scored with the groom and
bride reversed.

It now orders groom-first, using the same rule as the endpoint. The sorted ids
are still the **cache key** (that must keep matching `scorer.ts`); only the
argument order to the calculator changed.

### What this changes in production, and what to do about it

`match_scores:{idA}:{idB}` feeds the matchmaking feed and is one of ten input
features to the DPI model. So this is a real behavioural change, not a silent
cleanup:

- Cached scores for pairs where direction matters will change once recomputed.
  Existing entries are **not** invalidated by this commit; they expire on the
  7-day TTL, so the change rolls in gradually rather than shifting every user's
  feed at once. That is the safer default.
- To apply it immediately instead, flush the keys and let the job repopulate:
  `redis-cli -u $REDIS_URL --scan --pattern 'match_scores:*' | xargs redis-cli -u $REDIS_URL DEL`
  Do this deliberately, not as a routine step — it re-orders the feed for
  everyone at once and re-runs the AI service across every pair.
- `guna_milan_score` is a DPI input, so if DPI was calibrated on the old
  (reversed for half of pairs) values, its calibration is now slightly off.
  Worth a re-check against fresh scores before relying on DPI thresholds.

Note the magnitude is small per pair — the measured example moved 15/36 to
14/36 by zeroing Varna — but it is systematic rather than random, since it
applies to whichever half of pairs sorted the "wrong" way.

### What to do about it

1. Decide whether Varna/Tara/Bhakoot direction should be corrected in the feed
   score, or whether the feed should keep using a deliberately symmetric score
   and only the user-facing endpoint should be strict.
2. If correcting: add gender to `MatchComputeJob`, order groom-first, then
   invalidate `match_scores:*` and let the job repopulate.
3. Check whether DPI needs re-calibration, since `guna_milan_score` is one of
   its ten input features.

Until then the two paths can disagree: the compatibility page may show a
different total than the score behind the match feed. For most pairs they
agree; for pairs where the direction matters, they will not.
