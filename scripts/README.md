# Smart Shaadi — scripts

## seed-demo-data.ts

Seeds **3 rich demo profiles** via the live API for the May 16 client demo
(Aarav Sharma ↔ Priya Joshi ↔ Anjali Mehta). Idempotent — safe to re-run.

### Run

```bash
pnpm seed:demo
```

### Environment variables

| Var               | Default                                | Purpose                                                   |
|-------------------|----------------------------------------|-----------------------------------------------------------|
| `API_URL`         | `http://localhost:3001`                | Base URL of the api app                                   |
| `SEED_OTP`        | `135246`                               | OTP code (must match `MOCK_OTP_VALUE` in api env)         |
| `ALLOW_PROD_SEED` | unset                                  | Set to `true` to skip the prod confirmation prompt        |
| `SKIP_CHAT`       | unset                                  | Set to `true` to skip socket.io chat seeding              |
| `SKIP_AI`         | unset                                  | Set to `true` to skip DPI/FII compute calls               |

### What it does

1. **Auth (per profile)** — OTP send + verify via Better Auth phone-number
   plugin. Captures `better-auth.session_token` from `Set-Cookie`.
2. **Profile fill** — populates personal, education, profession, family,
   lifestyle, horoscope, preferences, personality, plus the profile-level
   `stayQuotient` and `familyInclinationScore` fields.
3. **Photo upload** — 3 photos per profile from `picsum.photos` (royalty-free,
   reliable). Two-step: presign → R2 PUT → register.
4. **Interest + match** — Aarav sends interest to Priya, Priya accepts.
   Idempotent: skips if a non-pending request already exists.
5. **Chat seed** — 3-message conversation via socket.io `send_message`
   (REST has no plain-text endpoint). Skipped when `SKIP_CHAT=true`.
6. **Wedding** — creates one wedding on Aarav's account if none exists,
   adds 5 guests.
7. **AI compute** — calls DPI + FII on the accepted match. Optional second
   pair Aarav↔Anjali for the MEDIUM-compatibility demo case.
8. **Final report** — prints userIds, profileIds, matchId, weddingId,
   successes, failures. Exit 0 if signup + match flow succeed, 1 otherwise.

### Idempotency

- Profiles use `PUT` on each section → upserts.
- Photos: skipped per-user if photo count already ≥ configured seed list.
- Interests: list-sent first, reuses existing requestId; accept tolerates
  4xx for non-PENDING state.
- Weddings: list first, skips create if one exists for the user.
- Guests: best-effort, swallows duplicate errors.

### Requirements

- API server reachable at `API_URL` with `USE_MOCK_SERVICES=true` (real
  OTP path throws `MSG91 not configured` outside mock mode).
- `MOCK_OTP_VALUE` env var on the api side must equal `SEED_OTP` here.
- Phone numbers are hardcoded test numbers: `+919999999999`,
  `+918120684036`, `+919876543210`.

### Profile data source

`docs/demo/demo-data-plan.md` → mirrored into `seed-demo-data.config.ts`.
Edit the config file, not the markdown, when tweaking demo content.

### Expected AI output

| Pair          | DPI level | FII compatibility |
|---------------|-----------|-------------------|
| Aarav↔Priya   | LOW       | HIGH (~85–95)     |
| Aarav↔Anjali  | MEDIUM    | MEDIUM (~50–65)   |

### Runtime

≈ 5–10 minutes depending on network + R2 latency.
