# ADR-002 — Cross-origin session cookie + CORS for web↔api

- **Status:** Accepted
- **Date:** 2026-06-07
- **Context files:**
  `apps/api/src/auth/cookieAttributes.ts`,
  `apps/api/src/auth/config.ts`,
  `apps/api/src/lib/cors.ts`,
  `apps/api/src/index.ts` (Express CORS mount),
  `apps/api/src/chat/socket/index.ts` + `apps/api/src/chat/socket/auth.ts`,
  `apps/web/src/lib/socket/SocketProvider.client.tsx`

## Context

The web app and the API run on **different subdomains**:

```
web   → https://smartshaadi.co.in        (Vercel)
api   → https://api.smartshaadi.co.in     (Railway)
```

To a browser these are *cross-site* origins. Every authenticated browser→API call
is therefore a **credentialed cross-site request**, and every such request is
governed by two independent gatekeepers that must agree:

1. **The cookie's own `SameSite`/`Secure`/`Domain` attributes** — decide whether
   the browser will even *attach* the session cookie to the request.
2. **CORS (`Access-Control-Allow-Origin` + `credentials`)** — decides whether the
   browser will *expose* the response to the calling page.

A third gatekeeper, **Better Auth `trustedOrigins`**, validates the Origin on auth
POSTs (CSRF/callback) *after* CORS has already let the preflight through.

This boundary is easy to get subtly wrong, and it bit us twice in production
(see **History** below). Phase 7 mobile (React Native) will cross this same
boundary again with *no cookie jar at all*. This ADR records the decision so it
is not rediscovered by trial and error.

## Decision

### 1. Session cookie attributes

The Better Auth session cookie is named `better-auth.session_token` (the
`__Secure-` auto-prefix is **disabled** via `advanced.useSecureCookies: false` so
the name is identical in dev and prod — server-side fetches in the web app don't
have to guess between two names). Attributes are set explicitly by
`sessionCookieAttributes()` (`apps/api/src/auth/cookieAttributes.ts`):

| Attribute  | Production                | Development           | Why |
|------------|---------------------------|-----------------------|-----|
| `HttpOnly` | `true`                    | `true`                | JS must never read the session token (CLAUDE.md: no tokens in localStorage). Cross-origin sockets carry it via the handshake Cookie header instead — see §2. |
| `Secure`   | `true`                    | `false`               | `SameSite=None` is only honoured by browsers when `Secure` is also set. In dev the cookie must travel over plain `http://localhost`, where a `Secure` cookie is never set or sent — so both relax together. |
| `SameSite` | `None`                    | `Lax`                 | Prod requests from `smartshaadi.co.in` (and Vercel preview origins) to `api.smartshaadi.co.in` are cross-*site*; only `SameSite=None` is attached on a cross-site credentialed request. Dev is same-origin (`localhost:3000` → `localhost:<api>`), so `Lax` suffices and avoids needing `Secure`. |
| `Domain`   | `.smartshaadi.co.in`      | *(unset)*             | Scopes the cookie to the API's registrable domain — where it is set and read — so it is shared across the `api.` and apex subdomains independent of which frontend origin made the request. Unset in dev (host-only on `localhost`). |

Session lifetime: **30-day** expiry with a **5-minute** in-memory cookie cache
(`config.ts` `session` block).

> **Note (comment drift, 2026-06-07):** code comments in
> `chat/socket/auth.ts` and `SocketProvider.client.tsx` still describe the cookie
> as `SameSite=Lax`. The authoritative prod value is `SameSite=None; Secure`
> (`cookieAttributes.ts`). This ADR documents the real value; the stale comments
> are a known follow-up, intentionally **not** changed in the docs-only branch
> that introduced this ADR.

### 2. Socket auth across the origin boundary

Socket.IO's handshake is a cross-origin request, and the session credential has
to reach the server through it. `handshakeCookie()`
(`apps/api/src/chat/socket/auth.ts`) accepts **two credential sources, in
priority order**:

1. **`handshake.auth.token`** (primary) — an explicit token. This is the
   server-component path: the web app reads the httpOnly cookie *server-side* and
   passes its value as a prop. The server reframes it as
   `better-auth.session_token=<token>`.
2. **`handshake.headers.cookie`** (fallback) — the raw Cookie header. A
   cross-origin browser client connecting with **`withCredentials: true`** carries
   the httpOnly session cookie here. JS cannot read that cookie (HttpOnly), so its
   `auth.token` is empty — the raw-header path is what authenticates the live
   browser socket.

`authenticateHandshake()` then validates whichever source produced a value via
`auth.api.getSession({ headers: { cookie } })`, returning the `userId` or `null`
(it never throws). The web client wires both ends:
`SocketProvider.client.tsx` passes `auth: { token }` **and** `withCredentials:
true`; `ChatsListClient.client.tsx` likewise sets `withCredentials: true`.

**Why both paths exist:** the `auth.token` path covers server-rendered contexts
where the cookie is read server-side; the Cookie-header path covers the live
browser socket where only the browser holds the credential. Removing either one
reintroduces the "Unauthorized" socket incident.

### 3. CORS allowlist

A single shared delegate, `corsOriginDelegate` → `isAllowedOrigin`
(`apps/api/src/lib/cors.ts`), gates **both** the Express REST app
(`apps/api/src/index.ts`) and the Socket.IO server
(`apps/api/src/chat/socket/index.ts`) so the two can never drift. Both mount with
`credentials: true`. Key rules:

- **Never a wildcard.** Browsers reject `Access-Control-Allow-Origin: *` on a
  credentialed request, so the delegate echoes back the *specific* allowed origin
  or denies (`allow=false`, no ACAO header) — it never returns `*`.
- **A missing `Origin` is allowed** (same-origin navigations, curl,
  server-to-server). Credentialed browser requests always send an Origin, so this
  does not widen the credentialed surface.
- **Exact allowlist:**
  - **Prod:** `CORS_ORIGIN` (optional override), `WEB_URL`,
    `https://smartshaadi.co.in`, `https://www.smartshaadi.co.in`.
  - **Dev:** `WEB_URL`, `http://localhost:3000`, `http://127.0.0.1:3000`.
- **Vercel preview origins** are matched by regex anchored to **both** the
  `vivah-web` project prefix **and** the `smartshaadiofficial-7717s-projects`
  team suffix — tight enough that an arbitrary third-party `*.vercel.app` origin
  never matches. (This anchoring is the fix for incident #2.)
- Express sets `allowedHeaders` including `Cookie` and methods including
  `OPTIONS` (preflight).

### 4. Better Auth `trustedOrigins` mirrors the CORS allowlist

`authTrustedOrigins()` (`config.ts` → `cors.ts`) returns the **same** static
origins plus the Vercel preview globs. This must stay in lockstep with
`isAllowedOrigin()`: a preflight that Express CORS lets through is useless if
Better Auth then rejects the auth POST on Origin grounds. One source of truth
(`lib/cors.ts`), two consumers.

## History — the two incidents that motivated this

1. **Chat socket "Unauthorized."** The httpOnly session cookie was not reaching
   the cross-origin socket handshake, so every socket connection failed auth.
   Fixed by accepting the raw handshake Cookie header as a fallback credential
   source (§2) and setting `withCredentials: true` on the client.
2. **Vercel preview origins CORS-blocked from `/api/auth`.** Preview deploys
   were denied by CORS / Better Auth. Fixed by adding the project+team-anchored
   Vercel preview matcher to both `isAllowedOrigin()` and `authTrustedOrigins()`
   (§3, §4).

Both landed together and merged to `main` on 2026-06-06.

## Consequences

- The cookie, CORS, and `trustedOrigins` rules are **coupled** — change one and
  you almost certainly must change the others. `lib/cors.ts` is the single source
  of truth for the origin allowlist; keep it that way.
- Dev and prod use **deliberately different** cookie attributes. A bug that only
  appears in prod (or only in dev) is very often this `SameSite`/`Secure` split —
  check `cookieAttributes.ts` first.

## Phase 7 mobile — this cookie path does NOT apply

React Native has **no browser cookie jar** and does not participate in
`SameSite`/`Secure`/CORS at all. Mobile auth must use a **token strategy**, not
this cookie flow:

- Issue/return a bearer session token to the app and store it in secure device
  storage (Keychain / Keystore), **not** a cookie.
- Send it explicitly: `Authorization: Bearer <token>` on REST calls, and on the
  socket via `handshake.auth.token` — which the server **already accepts** as the
  primary credential source (§2). The existing `auth.token` branch was built with
  this in mind; mobile slots into it without server changes.
- CORS is irrelevant to a native app (no browser origin), but Better Auth origin
  validation may still apply to auth endpoints — verify before the mobile build.

Do **not** try to make RN speak the cookie path. Use the token path that the
socket handshake already supports.
