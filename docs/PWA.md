# PWA — manifest, service worker, offline shell

> Phase 7 contract item: *"Installable PWA with offline capability and home screen
> shortcut."* Built 2026-07-19. No new dependencies — `next-pwa`, `serwist` and
> `workbox` were all considered and rejected.

## Files

| Path | Role |
|---|---|
| `apps/web/src/app/manifest.ts` | Next 15 native manifest route → `/manifest.webmanifest` |
| `apps/web/public/sw.js` | Hand-rolled service worker (~140 lines, no deps) |
| `apps/web/public/offline.html` | Static offline shell — no React, no Tailwind runtime |
| `apps/web/public/icons/` | 192/512 PNG, plus maskable variants |
| `apps/web/src/components/ServiceWorkerRegistrar.client.tsx` | Registers the SW (production only) |

## The caching rule: allowlist, never denylist

**Only content-addressed static assets are ever cached.** Navigations and API
responses are network-only — no cache read, no cache write, no offline fallback
to stale data.

This is the whole design, and it is deliberate. The intuitive alternative —
"cache everything except authenticated responses", detecting auth with
`response.headers.has('set-cookie')` — is **broken and was shipped in the first
draft of this file**. `Set-Cookie` is a *forbidden response-header name* in the
Fetch spec: the browser never exposes it to JavaScript, not even same-origin.
The check silently returns `false` for every response, so the denylist never
fires and every authenticated page and API payload lands in the cache while the
code reads as if it were guarded.

On a matrimonial platform that is not a performance bug. On a shared device — a
family tablet, an internet café — user B is served user A's cached matches,
profile and chat. A guard that cannot fail closed must not be the only thing
between users and each other's private data.

So we do not detect what is unsafe. We enumerate what is safe:

```js
const CACHEABLE_PATTERNS = [
  /^\/_next\/static\//,          // content-hashed by Next, immutable
  /^\/icons\//,
  /\.(?:woff2|ttf|eot|otf)$/,
  /^\/favicon\.ico$/,
  /^\/manifest\.webmanifest$/,
];
```

Before adding a pattern, ask: *could this response ever differ per user?* If the
answer is anything but a confident no, leave it out.

| Request | Strategy | Cached? |
|---|---|---|
| `/_next/static/*`, icons, fonts | cache-first, populate on miss | yes |
| HTML navigation | network-only, `offline.html` on failure | **no** |
| `/api/**` (incl. `/api/auth/*`) | network-only, passthrough | **no** |
| Everything else | untouched, browser-native | **no** |

The `activate` handler deletes every cache except the current `static-v1`. That
also purges any `dynamic-*` cache left by the denylist draft — anyone who loaded
that version keeps a poisoned cache until it is explicitly removed, so the
cleanup is a security fix, not hygiene.

## Locale-agnostic scope

`next-intl` runs `localePrefix: 'as-needed'`, so the default locale is
**unprefixed** (`/matches`) while Hindi is `/hi/matches`. The manifest
`start_url`/`scope` and the SW registration scope are therefore all `/`. A
`/en/` scope would silently exclude half the routing surface from install.
Manifest `shortcuts` are root-relative for the same reason.

## Registration is production-only

`ServiceWorkerRegistrar` returns early unless `NODE_ENV === 'production'`. A SW
in dev caches the app shell and then serves it back after you edit the source,
which presents as "my change did nothing" and costs an hour before anyone
suspects the worker. Nothing about the PWA needs proving on localhost.

To exercise it against a dev server, register it by hand from the console:

```js
await navigator.serviceWorker.register('/sw.js', { scope: '/' });
```

## Verification performed (2026-07-19)

Driven in a real browser against a running app, not inferred from code:

1. **Assets serve** — `/manifest.webmanifest` 200 `application/manifest+json`,
   `/sw.js` 200, `/offline.html` 200, all four icons 200.
2. **Manifest shortcuts resolve** — `/matches` and `/chats` both return 307
   (auth redirect), i.e. real routes. An earlier draft pointed at
   `/dashboard/matches` and `/dashboard/profile`, which are 404s.
3. **No authenticated content cached** — registered the SW, loaded an
   authenticated `/dashboard`, then enumerated every cache entry. Result: only
   `static-v1`, containing static chunks + fonts + manifest + icons +
   `offline.html`. Zero `/api/*`, zero authenticated HTML. This is the
   session-bleed guarantee, checked rather than assumed.
4. **Offline fallback** — stopped the web server outright and navigated to
   `/matches`. The offline shell rendered ("You're Offline") at 375px.

### Not yet verified

- Install prompt / home-screen add on a real Android device.
- Behaviour under a genuine flaky connection (verified only with the server
  fully down, which is the easy case).
- iOS Safari, which restricts SW lifetime and install behaviour.
