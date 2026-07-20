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

## What is still unfixed: the background job

`apps/api/src/jobs/gunaRecalcJob.ts` sorts the two profile ids alphabetically
and passes them as `profile_a` / `profile_b`:

```ts
const [idA, idB] = [job.data.profileAId, job.data.profileBId].sort();
```

This is **deterministic** — it does not have the inconsistency bug above — but
it is **not gender-ordered**. Roughly half of all pairs are therefore scored
with the groom and bride reversed, so Varna, Tara and Bhakoot can be computed
against the wrong direction.

### Why it was not fixed in the same change

The number this job writes (`match_scores:{idA}:{idB}`) feeds the matchmaking
feed and is an input feature to the DPI model. Correcting the ordering would:

- change existing cached scores for about half of all pairs,
- shift match-feed ordering for those users,
- and alter a feature the DPI model was calibrated against.

That is a real behavioural change to live matchmaking, and it needs a decision
about backfill and re-calibration rather than a quiet edit made unattended. It
is not a regression introduced here — it is pre-existing, and it predates the
user-facing feature.

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
