# i18n Migration Guide — apps/web

Smart Shaadi ships a Hindi-first interface alongside English (per the
05-Apr-2026 agreement). The runtime uses [`next-intl`] with locales
`en` and `hi`.

This document explains how to add new strings, how to use them in
Server vs Client components, and what's left to migrate.

[`next-intl`]: https://next-intl-docs.vercel.app/

---

## TL;DR

- All UI strings live in `apps/web/messages/{en,hi}.json`.
- Server Components: `const t = await getTranslations('namespace')`.
- Client Components: `const t = useTranslations('namespace')`.
- Default locale: `en` (no URL prefix).
- Hindi locale: `hi` — served at `/hi/...` (e.g. `/hi/feed`).
- Locale config: `apps/web/src/i18n/routing.ts`.
- Provider wiring: `apps/web/src/app/layout.tsx` (root, async).

---

## Architecture

```
apps/web/
├── messages/
│   ├── en.json         # English strings (source of truth)
│   └── hi.json         # Hindi strings (mirror of en.json)
├── src/
│   ├── i18n/
│   │   ├── routing.ts  # locales + defaultLocale + localePrefix
│   │   └── request.ts  # message loader called per request
│   ├── middleware.ts   # next-intl locale routing + auth (combined)
│   └── app/
│       └── layout.tsx  # NextIntlClientProvider wrapper
└── next.config.ts      # wrapped with createNextIntlPlugin
```

Routing strategy: `localePrefix: 'as-needed'`.

- `/feed`     → default locale (English)
- `/hi/feed`  → Hindi
- `/en/feed`  → redirect to `/feed`

---

## Adding a new string

### 1. Add it to **both** message files

`apps/web/messages/en.json`:

```json
{
  "settings": {
    "profile": {
      "saveButton": "Save profile"
    }
  }
}
```

`apps/web/messages/hi.json` (mirror the **exact** structure):

```json
{
  "settings": {
    "profile": {
      "saveButton": "प्रोफ़ाइल सहेजें"
    }
  }
}
```

If you don't have a confident Hindi translation, leave the English
value with a `HINDI:` prefix so it can be found later:

```json
{ "saveButton": "HINDI: Save profile" }
```

> A grep for `"HINDI:` will surface every string still needing review.

### 2. Use it in a component

**Server Component** (no `'use client'`):

```tsx
import { getTranslations } from 'next-intl/server';

export default async function ProfileSettings() {
  const t = await getTranslations('settings.profile');
  return <button>{t('saveButton')}</button>;
}
```

**Client Component** (`'use client'`):

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function SaveBar() {
  const t = useTranslations('settings.profile');
  return <button>{t('saveButton')}</button>;
}
```

---

## Naming convention

`namespace.section.specific`

| Level     | Example                          | Notes                              |
|-----------|----------------------------------|------------------------------------|
| Namespace | `feed`, `pricing`, `home`, `nav` | Top-level — usually a route group  |
| Section   | `feed.header`, `feed.empty`      | Conceptual grouping inside a page  |
| Specific  | `feed.header.title`              | The actual leaf string             |

Shared widgets use `common.*` (e.g. `common.save`, `common.cancel`).
Navigation labels use `nav.*`.

Avoid duplicating the same English string under two different keys —
prefer reusing `common.save` over inventing `mypage.saveBtn`.

---

## Interpolation & rich text

### Plain interpolation

```json
{ "greeting": "Hello, {name}!" }
```

```tsx
t('greeting', { name: user.firstName })
```

### Rich text (embed React nodes inside a string)

```json
{ "footer": "Cancel from <link>Billing</link> anytime." }
```

```tsx
t.rich('footer', {
  link: (chunks) => <Link href="/settings/billing">{chunks}</Link>,
})
```

### Plurals

Use distinct keys (we keep it simple — no ICU `plural` blocks yet):

```json
{
  "countSingular": "{count} match found",
  "countPlural":   "{count} matches found"
}
```

```tsx
items.length === 1
  ? t('countSingular', { count: items.length })
  : t('countPlural', { count: items.length })
```

---

## Testing locale switching

1. Start the dev server: `pnpm --filter @smartshaadi/web dev`.
2. Visit `http://localhost:3000/feed` → English.
3. Visit `http://localhost:3000/hi/feed` → Hindi.
4. Strings still in English under `/hi` are un-migrated; grep them.

Locale persistence (cookie-based switching from a UI dropdown) is a
follow-up: next-intl exposes `useRouter()` and `usePathname()` from
`@/i18n/navigation` for this. Not yet wired — see "What's left".

---

## Combined middleware (auth + i18n)

`apps/web/src/middleware.ts` runs the next-intl middleware first
(locale detection / redirects), then falls through to our existing
Better Auth session/role guards. The auth path matching strips the
locale prefix so `/hi/dashboard` is treated the same as `/dashboard`.

If you add a new protected route prefix, update the `PROTECTED_PREFIXES`
array in that file.

---

## What's left to migrate

Migrated in this PR:

- `apps/web/src/components/marketing/Hero.client.tsx` — home hero
- `apps/web/src/app/(app)/feed/page.tsx`              — match feed
- `apps/web/src/app/(app)/pricing/page.tsx`           — pricing

High-traffic candidates remaining (sample — not exhaustive):

- `apps/web/src/components/marketing/StatsBar.client.tsx`
- `apps/web/src/components/marketing/HowItWorks.tsx`
- `apps/web/src/components/marketing/FeaturesGrid.tsx`
- `apps/web/src/components/marketing/TrustSection.tsx`
- `apps/web/src/components/marketing/Testimonials.tsx`
- `apps/web/src/components/marketing/Pricing.tsx`
- `apps/web/src/components/marketing/CtaBanner.tsx`
- `apps/web/src/components/marketing/Footer.tsx`
- `apps/web/src/components/marketing/Navbar.client.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/verify/page.tsx`
- `apps/web/src/app/(auth)/verify-otp/page.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/app/(app)/matches/page.tsx`

The migration is incremental — un-migrated strings stay in English
for both locales without breaking the build. Convert pages as they
get touched for other reasons, or sweep them in a dedicated pass.

---

## Adding a locale switcher (future work)

When ready, build a switcher component using `next-intl/navigation`:

```tsx
'use client';
import { useRouter, usePathname } from '@/i18n/navigation'; // create this
import { useLocale } from 'next-intl';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value })}
    >
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
    </select>
  );
}
```

`@/i18n/navigation.ts` should re-export `createNavigation(routing)`
from `next-intl/navigation` once the switcher is needed.
