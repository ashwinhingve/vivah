# Profile Save & Display Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs causing profile data to not save correctly across all 8 onboarding pages and not appear on dashboard/profile pages.

**Architecture:** Data flows through Next.js Server Actions → Express API → Zod validation → service functions → PostgreSQL (Drizzle) + MongoDB (or mockStore in dev). `getMyProfile()` enriches responses with content from both stores. Bugs are spread across the API service layer, Mongoose schema, API router, and frontend UI.

**Tech Stack:** TypeScript, Express, Drizzle ORM, Mongoose, Next.js 15 Server Actions, shadcn/ui, Tailwind v4

---

## Bug Index

| # | Severity | File | Description |
|---|----------|------|-------------|
| 2 | Critical | `apps/api/src/profiles/content.service.ts` | `photos` missing from `onConflictDoUpdate` → photo completeness stuck at false |
| 5 | Prod-critical | `apps/api/src/infrastructure/mongo/models/ProfileContent.ts` | `horoscope.manglik` declared `Boolean` but schema/types use `'YES'\|'NO'\|'PARTIAL'` |
| 3 | Important | `apps/api/src/profiles/service.ts` | `getMyProfile()` never reads `communityZones` table → community data invisible |
| 6 | Minor | `apps/api/src/profiles/content.router.ts` | partner-preferences handler drops `maritalStatus` + `partnerDescription` |
| 4 | UX | `apps/web/src/app/(onboarding)/profile/lifestyle/page.tsx` | `languagesSpoken` field not in UI — always saved as empty array |

---

## Task 1: Fix photos completeness in `onConflictDoUpdate`

**Files:**
- Modify: `apps/api/src/profiles/content.service.ts` (the `onConflictDoUpdate` `set` block, around line 218–229)

**Root cause:** `computeAndUpdateCompleteness()` inserts `photos: true/false` correctly on first call but the UPDATE path (every subsequent call) never includes `photos` in the `set` clause, so photo completeness stays permanently at whatever it was on the first insert.

- [ ] **Step 1: Locate the set block**

Open `apps/api/src/profiles/content.service.ts` and find the `.onConflictDoUpdate({ target: profileSections.profileId, set: { ... } })` block. It currently looks like:

```ts
.onConflictDoUpdate({
  target: profileSections.profileId,
  set: {
    personal,
    family,
    career,
    lifestyle,
    horoscope,
    preferences,
    updatedAt: new Date(),
  },
});
```

- [ ] **Step 2: Add `photos` to the set clause**

```ts
.onConflictDoUpdate({
  target: profileSections.profileId,
  set: {
    personal,
    family,
    career,
    lifestyle,
    horoscope,
    photos,
    preferences,
    updatedAt: new Date(),
  },
});
```

- [ ] **Step 3: Run type-check**

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/profiles/content.service.ts
git commit -m "fix(profiles): add photos to onConflictDoUpdate so photo completeness updates correctly"
```

---

## Task 2: Fix Mongoose `horoscope.manglik` type

**Files:**
- Modify: `apps/api/src/infrastructure/mongo/models/ProfileContent.ts` (lines 28 and 107)

**Root cause:** Both `horoscope.manglik` fields in the Mongoose schema are declared as `Boolean`. The Zod schema (`UpdateHoroscopeSchema`) and TypeScript type (`ManglikStatus`) both define it as `'YES' | 'NO' | 'PARTIAL'`. In production MongoDB, Mongoose coerces all string values to `true` (JS truthiness). The mock store bypasses Mongoose so this only breaks in production.

- [ ] **Step 1: Fix line 28 — horoscope section manglik**

Find this in `ProfileContent.ts`:

```ts
// Around line 25-30, in the horoscope subdocument:
horoscope: {
  // ...
  manglik:       Boolean,
```

Change to:

```ts
horoscope: {
  // ...
  manglik:       String,
```

- [ ] **Step 2: Fix line 107 — second manglik declaration**

Find the second `manglik: Boolean` around line 107 (likely in an embedded schema or second horoscope block) and change to `String`.

- [ ] **Step 3: Verify line 120 (partnerPreferences.manglik) is already String**

```bash
grep -n 'manglik' apps/api/src/infrastructure/mongo/models/ProfileContent.ts
```

Expected output: all three `manglik` lines should now show `String`.

- [ ] **Step 4: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/mongo/models/ProfileContent.ts
git commit -m "fix(profiles): horoscope.manglik Mongoose type Boolean→String to match ManglikStatus enum"
```

---

## Task 3: Return community data from `getMyProfile()`

**Files:**
- Modify: `apps/api/src/profiles/service.ts` — `getMyProfile()` function (around line 116–183)
- Modify: `apps/api/src/profiles/service.ts` — `ProfileResponse` interface (around line 95–112)

**Root cause:** `getMyProfile()` reads profileSections and MongoDB content but never queries the `communityZones` PostgreSQL table. Community data is saved correctly by the community page but then invisible on every response from `GET /me`.

**Imports needed:** `communityZones` is already exported from `@smartshaadi/db` alongside `profileSections`.

- [ ] **Step 1: Add `CommunityZoneData` to `ProfileResponse` type**

Find the `ProfileResponse` interface or type in `service.ts` (around line 95). Add these optional fields:

```ts
export interface ProfileResponse {
  // ... existing fields ...
  community?: string | null;
  subCommunity?: string | null;
  motherTongue?: string | null;
  preferredLang?: string | null;
  lgbtqProfile?: boolean | null;
  // ... rest of existing fields ...
}
```

- [ ] **Step 2: Import `communityZones` table**

Near the top of `service.ts`, find where `profileSections`, `profilePhotos`, etc. are imported from `@smartshaadi/db`. Add `communityZones` to that import:

```ts
import { profiles, profilePhotos, profileSections, communityZones } from '@smartshaadi/db';
```

(Check the existing import statement and add `communityZones` to it.)

- [ ] **Step 3: Query communityZones in `getMyProfile()`**

Inside `getMyProfile()`, after the `profileSections` query and before building the return value, add:

```ts
const [communityRow] = await db
  .select()
  .from(communityZones)
  .where(eq(communityZones.profileId, profile.id));
```

- [ ] **Step 4: Spread community data into the return value**

In the `return { ...base, ... }` block at the end of `getMyProfile()`, add the community fields:

```ts
return {
  ...base,
  ...(communityRow != null && {
    community:     communityRow.community,
    subCommunity:  communityRow.subCommunity,
    motherTongue:  communityRow.motherTongue,
    preferredLang: communityRow.preferredLang,
    lgbtqProfile:  communityRow.lgbtqProfile,
  }),
  // ... rest of existing spread expressions (contentDoc, sectionsRow) ...
};
```

- [ ] **Step 5: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/profiles/service.ts
git commit -m "fix(profiles): join communityZones in getMyProfile so community page data appears in responses"
```

---

## Task 4: Fix `content.router.ts` partner-preferences missing fields

**Files:**
- Modify: `apps/api/src/profiles/content.router.ts` (around line 291–305, the `/partner-preferences` handler)

**Root cause:** The `PUT /me/content/partner-preferences` handler builds `input` but omits `maritalStatus` and `partnerDescription`. The onboarding flow uses `PUT /me/preferences` (preferencesRouter) which passes data through correctly — so this bug only affects future profile-edit pages that call the content router path directly. Fix now to prevent silent data loss later.

- [ ] **Step 1: Add missing fields to partner-preferences handler**

Find the handler body in `content.router.ts` around line 291. It ends with:

```ts
if (parsed.data.openToInterCaste != null) input.openToInterCaste = parsed.data.openToInterCaste;

const content = await updatePartnerPreferences(req.user!.id, input);
```

Add the two missing lines before the `updatePartnerPreferences` call:

```ts
if (parsed.data.openToInterCaste != null) input.openToInterCaste = parsed.data.openToInterCaste;
if (parsed.data.maritalStatus != null) input.maritalStatus = parsed.data.maritalStatus;
if (parsed.data.partnerDescription != null) input.partnerDescription = parsed.data.partnerDescription;

const content = await updatePartnerPreferences(req.user!.id, input);
```

- [ ] **Step 2: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/profiles/content.router.ts
git commit -m "fix(profiles): content.router partner-preferences now maps maritalStatus and partnerDescription"
```

---

## Task 5: Add `languagesSpoken` chip selector to lifestyle page

**Files:**
- Modify: `apps/web/src/app/(onboarding)/profile/lifestyle/page.tsx`

**Root cause:** `actions.ts` reads `languagesSpoken` via `formData.getAll('languagesSpoken')` but the lifestyle page has no input with that name. So it's always sent as `[]` and the guard `if (languagesSpoken.length > 0)` prevents it from ever reaching the API.

- [ ] **Step 1: Add `selectedLanguages` state and toggle function**

In `LifestylePage()`, add alongside the existing `useState` calls:

```ts
const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

function toggleLanguage(lang: string) {
  setSelectedLanguages((prev) =>
    prev.includes(lang) ? prev.filter((x) => x !== lang) : [...prev, lang],
  );
}
```

- [ ] **Step 2: Add `LANGUAGES` constant near the top of the file**

After the existing `HOBBIES` array, add:

```ts
const LANGUAGES = [
  'Hindi', 'English', 'Marathi', 'Bengali', 'Telugu',
  'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
  'Odia', 'Urdu', 'Rajasthani', 'Bhojpuri', 'Maithili',
];
```

- [ ] **Step 3: Add hidden inputs for selected languages**

In the JSX, alongside the existing hidden inputs for hobbies and tags, add:

```tsx
{selectedLanguages.map((lang) => (
  <input key={lang} type="hidden" name="languagesSpoken" value={lang} />
))}
```

- [ ] **Step 4: Add the language chip picker UI**

Add a new section in the form, after the hobbies section and before the personality tags section:

```tsx
<div>
  <label className="block text-sm font-medium text-[#2E2E38] mb-2">Languages Spoken</label>
  <div className="flex flex-wrap gap-2">
    {LANGUAGES.map((lang) => (
      <button
        key={lang}
        type="button"
        onClick={() => toggleLanguage(lang)}
        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
          selectedLanguages.includes(lang)
            ? 'bg-[#0E7C7B] text-white border-[#0E7C7B]'
            : 'bg-white text-[#6B6B76] border-[#E8E0D8] hover:border-[#0E7C7B]'
        }`}
      >
        {lang}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Run type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(onboarding\)/profile/lifestyle/page.tsx
git commit -m "fix(onboarding): add languagesSpoken chip picker to lifestyle page so field is actually saved"
```

---

## Verification

After all 5 tasks complete:

- [ ] **Full type-check passes:**
  ```bash
  pnpm type-check
  ```

- [ ] **Run tests:**
  ```bash
  pnpm test
  ```

- [ ] **Manual end-to-end check:**
  1. Start dev: `pnpm dev`
  2. Complete onboarding → lifestyle page: select 3 languages, verify they appear on save
  3. Complete horoscope page: set manglik to `PARTIAL`, verify it stores correctly
  4. Complete community page, then load dashboard — verify community fields appear
  5. Upload a photo, then reload dashboard — verify `sectionCompletion.photos` is `true` and score includes 20pts for photos
