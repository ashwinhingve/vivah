# Mobile — Build a Preview APK (EAS) + Every Other Way

> **Purpose.** The complete, end-to-end guide to building an installable Android build of the
> Smart Shaadi mobile app (`apps/mobile/`) — from first-time account setup, through the standard
> EAS cloud **preview APK**, to production AAB + Google Play submission, plus every alternative
> build method. This is the first mobile-build doc in the repo; it is the source of truth for
> "how do I get an APK onto a phone".
>
> **Audience.** The developer (Ashwin) for setup/build sections; the Colonel / QA testers for the
> **[Install on a phone](#5-install-the-apk-on-an-android-phone)** and **[Distribute](#6-distribute-to-testers)** sections.
>
> **Scope of this box.** This dev machine (WSL2) has **no local Android toolchain** — no Java, no
> Android SDK, no Gradle. `eas build --local`, `expo run:android`, and bare Gradle builds **cannot**
> run here. On this machine you use **EAS cloud builds only**. The other methods are documented for a
> machine that *does* have Android Studio.
>
> **Last updated:** 2026-07-30.

---

## TL;DR

If setup is already done (it is, on this repo), one command builds a preview APK:

```bash
# from inside WSL
cd ~/vivahOS/apps/mobile
npx eas-cli build --platform android --profile preview
```

Wait ~10–20 min → EAS prints a build URL → open it → download the `.apk` → install on an Android phone.
**Testers must uninstall any previous Smart Shaadi build first** (see [why](#keystores--why-testers-must-uninstall-first)).

| You do this... | ...how often |
|----------------|--------------|
| Install `eas-cli`, `eas login`, confirm project link | **once** (per machine / per Expo account) |
| `npx eas-cli build --platform android --profile preview` | **every build** |
| Uninstall old app on the test phone before installing | **every build after an account relink** |

---

## 1. What EAS is (30-second version)

**EAS Build** (Expo Application Services) is Expo's hosted build service. You push your JS/TS project
to Expo's cloud; their macOS/Linux builders run the native Android/iOS compile and hand you back a
signed `.apk` / `.aab`. It exists because compiling a React Native app natively needs the full Android
SDK + Gradle (and, for iOS, a Mac + Xcode) — EAS removes that requirement from your laptop.

- **Preview / development** builds → `.apk` (directly installable by sideloading).
- **Production** builds → `.aab` (Android App Bundle, for the Play Store; not directly installable).
- Signing keys (keystore) are generated and stored by EAS the first time you build.

The three build profiles for this app live in `apps/mobile/eas.json` — see the
[appendix](#profiles-easjson) for the full table.

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 20+** | The CI pins `20.x`. |
| **pnpm 9.x** | Monorepo package manager. |
| **An Expo account** | Free tier is fine. This is what `owner` in `app.json` points at. |
| **Run from WSL** | On this box, run all `eas`/`npx eas-cli` commands from inside WSL at `~/vivahOS/apps/mobile`. |
| **Internet** | Builds run in Expo's cloud; the CLI just uploads the project and polls. |

You do **not** need Android Studio, Java, or the Android SDK for the EAS cloud path.

> ⚠️ **WSL exec quirk.** When driving `eas-cli` through the Bash-tool → `wsl.exe` → `bash -lc` boundary,
> `$(...)`/`$var` are stripped to empty and paths starting with `/mnt/...` get mangled by MSYS. Run
> interactively from a real WSL shell, or embed the full path inside the quoted `bash -lc "..."` string.
> See memory `wsl-toolchain-execution`.

---

## 3. One-time setup

You should not need to redo this on a machine that already built successfully, but here it is from zero.

### 3.1 Install the EAS CLI

You don't need a global install — `npx eas-cli` pulls the latest on demand (this is what the proven
build command uses). If you prefer a pinned global binary:

```bash
npm install -g eas-cli
eas --version          # eas.json requires >= 13.0.0
```

### 3.2 Log in to Expo

```bash
cd ~/vivahOS/apps/mobile
npx eas-cli login       # or: eas login
npx eas-cli whoami      # confirm which account you're logged in as
```

> The account you log in as **must match** the `owner` field in `app.json`, or the build will fail
> with **"Entity not authorized"**. Current committed `owner` is **`hingve`** — see
> [quota management](#7-eas-free-quota-management-the-account-relink-reality) for why this has changed
> several times and how to switch it.

### 3.3 Confirm the project is linked

The project is already linked in the repo — you do **not** need to re-init unless you're relinking to a
different account. Verify:

```bash
npx eas-cli project:info
```

Expected (committed state):

| Field | Value |
|-------|-------|
| Owner | `hingve` |
| Slug | `smart-shaadi` |
| Project ID | `569b814a-5662-438b-8eea-32c8a8ad1f9d` |
| Android package | `in.co.smartshaadi.app` |

These come from `apps/mobile/app.json` (`expo.owner`, `expo.slug`, `expo.extra.eas.projectId`,
`expo.android.package`).

### 3.4 Environment variables — nothing to do

You do **not** create a `.env` for cloud builds. The API/media URLs and mock flag are **baked into the
build from `eas.json`** per profile (see [appendix](#env-vars)). The local `apps/mobile/.env`
(`EXPO_PUBLIC_API_URL=http://localhost:4000`) is only for `expo start` on-device dev, and is ignored by
the cloud builder.

---

## 4. Build a preview APK (the happy path)

This is the 95% command. Run it from WSL:

```bash
cd ~/vivahOS/apps/mobile
npx eas-cli build --platform android --profile preview
```

What happens, in order:

1. The CLI uploads the project to EAS.
2. On the builder, Expo runs `pnpm install`, then the **`eas-build-post-install`** hook
   (`apps/mobile/package.json`) which builds the three workspace packages the app imports —
   `@smartshaadi/types`, `@smartshaadi/schemas`, `@smartshaadi/api-client`. **If any of these fail to
   compile, the whole build fails** — so run `pnpm type-check` locally first.
3. EAS compiles a signed **`.apk`** (the `preview` profile sets `android.buildType: "apk"` and
   `distribution: "internal"`).
4. The CLI prints a **build details URL** (also visits in the browser). When it finishes (~10–20 min),
   that page has the **Download** button and an install **QR code**.

The preview APK is built with:

- `EXPO_PUBLIC_API_URL = https://api.smartshaadi.co.in` (talks to the **live** API)
- `EXPO_PUBLIC_MEDIA_URL = https://pub-7636b4a54e624991aabbe56292aff185.r2.dev` (R2 CDN)
- `EXPO_PUBLIC_MOCK_MODE = true`

> **On `--profile` vs `--build-profile`.** Modern eas-cli uses `--profile preview`. The CI workflow uses
> the older alias `--build-profile preview` — both select the same profile. Prefer `--profile` interactively.

> ⚠️ **Don't use the `development` profile as-is.** `eas.json`'s `development` profile sets
> `developmentClient: true`, which requires the **`expo-dev-client`** package — and it is **not** in
> `apps/mobile/package.json`. A `development` build will not give you a working dev client until that
> package is added (`npx expo install expo-dev-client`). For a plain installable test build, **use
> `preview`**.

---

## 5. Install the APK on an Android phone

> This section is safe to forward to a tester verbatim.

1. Open the EAS build page link on the phone (or scan the QR on the build page). Tap **Install** /
   **Download**.
2. Android will warn about installing from an unknown source. Allow it: **Settings → Apps → Special
   access → Install unknown apps →** (your browser / Files app) → **Allow**.
3. ⚠️ **Uninstall any previous "Smart Shaadi" app first** if one is installed — otherwise the install
   fails with a **signature mismatch** (see [below](#keystores--why-testers-must-uninstall-first)).
4. Open the `.apk` from the Downloads notification → **Install** → **Open**.
5. The app launches to the Smart Shaadi splash (burgundy `#7B2D42`). It points at the **live API**
   (`api.smartshaadi.co.in`) with mock mode on.

Works on any Android phone/emulator; no Play Store, no Google account needed for a preview APK.

---

## 6. Distribute to testers

The `preview` profile uses `distribution: "internal"` — EAS hosts a shareable **install link** (and QR)
on the build page. To share with the Colonel / QA:

- Send them the **build details URL** (from the CLI output or your Expo dashboard →
  Project → Builds → the build → **Install**).
- They follow [Section 5](#5-install-the-apk-on-an-android-phone).

> ⚠️ **Artifact links expire ~2 weeks** after the build. After that the download 404s and you must
> rebuild (which costs one quota unit — see next section). For a longer-lived copy, **download the
> `.apk` and store it** (e.g. attach to a release, or Drive) right after the build completes.

---

## 7. EAS free-quota management (the account-relink reality)

This is the single most important operational fact for this project's builds.

> **Free EAS Android build quota is per-account and monthly**, and resets around the **1st of the
> month**. When an Expo account uses up its free Android builds, you cannot build under it again until
> the reset — the CLI says *"...used its Android builds from the Free plan this month, which will reset
> in N days."*

The workaround this project has used repeatedly: **relink to a different Expo account**, which has its
own independent free quota.

### Account / project history

| Owner (account) | Project ID | Status |
|-----------------|------------|--------|
| **`hingve`** | `569b814a-5662-438b-8eea-32c8a8ad1f9d` | ✅ **Current** (committed in `app.json`) |
| `gulaabi-cleans-team` | `b291b6cf-78d5-4006-a81c-603784b01a25` | Superseded (quota exhausted) |
| `gulaabi-clean` | `403d8f3c-3f9a-4ab1-a2d4-2d100d443d66` | ⚠️ Dead — never restore |
| *(original)* | `9ebdf4da-cf8d-431f-b5c0-19e04bb32681` | ⚠️ Dead — account lost, "Entity not authorized" |

> ⚠️ **Never put a dead projectId back in `app.json`.** They are inaccessible or superseded and will
> break builds. Only the **current** row above is valid.

### How to switch accounts when quota is exhausted

1. Log in to the account that still has quota:
   ```bash
   npx eas-cli login          # log in as the target account
   npx eas-cli whoami         # confirm
   ```
2. Change `owner` in `apps/mobile/app.json` to that account's username.
3. Re-init to mint a fresh project under the new account (this rewrites `extra.eas.projectId`):
   ```bash
   cd ~/vivahOS/apps/mobile
   npx eas-cli project:init --non-interactive --force
   ```
4. Rebuild:
   ```bash
   npx eas-cli build --platform android --profile preview
   ```
5. Commit the updated `app.json` (`owner` + new `projectId`) and **update the history table above**.

### Keystores — why testers must uninstall first

Each relink (each `project:init`) generates a **brand-new keystore**. Android refuses to update an
installed app if the new APK is signed with a different key. So after any account switch, **every tester
must uninstall the old Smart Shaadi app before installing the new APK.** Within the *same* account/project,
the keystore is stable and updates install over the top fine.

---

## 8. Other ways to build

### 8.1 EAS local build — ⚠️ not possible on this machine

```bash
# Would build on YOUR machine instead of Expo's cloud (no quota cost):
npx eas-cli build --platform android --profile preview --local
```

This **does not work on this WSL box** — `--local` needs the native Android toolchain, and WSL here has
**no Java, no Android SDK, no Gradle**. A machine that *can* run it needs:

- JDK 17
- Android SDK + platform-tools + build-tools (via Android Studio or `sdkmanager`), `ANDROID_HOME` set
- Enough disk (~10 GB) and RAM

On a properly set-up machine, `--local` produces the same `.apk` without consuming EAS cloud quota.

### 8.2 GitHub Actions CI (already wired)

The repo has **`.github/workflows/eas-build.yml`**. It:

- Triggers on **manual dispatch** (Actions tab → *EAS Build* → *Run workflow*) **or** on push to `main`
  that touches `apps/mobile/**` or the workflow file.
- Sets up Node 20 + pnpm 9, runs `pnpm install`, sets up Expo via `expo/expo-github-action@v8`.
- Runs: `pnpm --filter @smartshaadi/mobile eas build --platform all --build-profile preview --non-interactive`.

**Requires the `EXPO_TOKEN` repo secret** (Settings → Secrets and variables → Actions). Generate it with
`npx eas-cli token:create` (or Expo dashboard → Account → Access tokens) under whichever account owns the
project. Note it builds `--platform all` (Android **and** iOS) — iOS will fail without Apple credentials;
narrow to `--platform android` in the workflow if you only want the APK.

> The CI build consumes the **same monthly quota** as a local `eas build`, under the token's account.

### 8.3 Bare `expo prebuild` + Gradle (full manual fallback)

For a machine with Android Studio, entirely off EAS:

```bash
cd apps/mobile
npx expo prebuild --platform android          # generates the native android/ project
cd android
./gradlew assembleRelease                       # release APK
# or: ./gradlew assembleDebug                    # debug APK, no signing config needed
```

- Output APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
  (or `.../debug/app-debug.apk`).
- A **release** build needs a signing config (your own keystore) wired into `android/app/build.gradle`;
  a **debug** build is signed with Android's debug key and installs fine for testing.
- The generated `android/` folder is disposable — this app is **managed/CNG** (no committed `android/`),
  so re-run `prebuild` after changing `app.json` plugins/config. Don't commit `android/`.

---

## 9. Production build + Google Play submission

> **Current status:** Not yet live — **blocked on Google Play Console enrollment** (see `ROADMAP.md`
> Phase 7). The steps below are the target procedure once enrolled.

### 9.1 Build a production AAB

```bash
cd ~/vivahOS/apps/mobile
npx eas-cli build --platform android --profile production
```

The `production` profile (`eas.json`) sets `autoIncrement: true` — EAS bumps the Android `versionCode`
automatically each build. It produces an **`.aab`** (App Bundle) by default, which is what the Play Store
requires (it is **not** directly sideloadable — use `preview` for that).

Before the first production build, bump the human-facing `version` in `app.json` (currently `0.1.0`) for
the release.

### 9.2 Submit to Google Play

1. **Enroll** in the Google Play Console (one-time US$25). Create the app entry with package
   `in.co.smartshaadi.app`.
2. Let **Google Play App Signing** manage the app signing key (recommended); EAS holds the upload key.
3. Provide store listing, content rating, data-safety form, privacy policy URL, screenshots.
4. Submit the AAB. Easiest path once a service-account JSON is configured:
   ```bash
   npx eas-cli submit --platform android --profile production
   ```
   (Configure `submit` credentials per Expo's *Submit to Google Play* guide — a Play Console
   service-account key JSON.) Alternatively, upload the `.aab` manually in the Console.
5. Release to the **Internal testing** track first for QA, then promote to Closed/Open testing, then
   Production.

> **FCM / push note.** `expo-notifications` is installed but there is **no** `google-services.json` in the
> repo. Remote push in a production build needs an FCM setup (Firebase project → server key → configured
> in EAS credentials). Local/preview builds run fine without it; wire FCM up before relying on push in prod.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| **"Entity not authorized"** on build | Logged-in account ≠ `owner` in `app.json`, or `projectId` points at a dead/other-account project | `npx eas-cli whoami`; match `owner`; or relink per [§7](#how-to-switch-accounts-when-quota-is-exhausted) |
| **"...used its Android builds from the Free plan this month"** | Monthly free quota exhausted for that account | Switch to another account + relink ([§7](#7-eas-free-quota-management-the-account-relink-reality)), or wait until ~1st |
| **Install fails: "App not installed" / signature mismatch** | New keystore after a relink vs the app already on the phone | **Uninstall** the old app, then install ([§7 keystores](#keystores--why-testers-must-uninstall-first)) |
| **Download link 404s** | Artifact expired (~2 weeks) | Rebuild; save the `.apk` locally next time |
| **Build fails in `eas-build-post-install`** | One of `@smartshaadi/types` / `schemas` / `api-client` fails to compile on the builder | Run `pnpm type-check` locally; fix TS errors before rebuilding |
| **`development` profile build has no working dev client** | `expo-dev-client` not installed | `npx expo install expo-dev-client`, or just use `preview` |
| **App shows mock/placeholder data** | `EXPO_PUBLIC_MOCK_MODE=true` is baked into `preview`/`development` | Expected for preview; change the profile's `env` in `eas.json` for a non-mock build |
| **iOS build fails in CI** | Workflow builds `--platform all` without Apple credentials | Change the workflow to `--platform android`, or set up Apple credentials |
| **CI never builds** | Missing `EXPO_TOKEN` secret | Add it under Actions secrets ([§8.2](#82-github-actions-ci-already-wired)) |

---

## 11. Config reference (appendix)

### Current identity

| Field | Value | Source |
|-------|-------|--------|
| App name | Smart Shaadi | `app.json` `expo.name` |
| Slug | `smart-shaadi` | `app.json` `expo.slug` |
| Owner (Expo account) | `hingve` | `app.json` `expo.owner` |
| EAS Project ID | `569b814a-5662-438b-8eea-32c8a8ad1f9d` | `app.json` `expo.extra.eas.projectId` |
| Android package | `in.co.smartshaadi.app` | `app.json` `expo.android.package` |
| iOS bundle ID | `in.co.smartshaadi.app` | `app.json` `expo.ios.bundleIdentifier` |
| App version | `0.1.0` | `app.json` `expo.version` |
| Expo SDK / RN | 57 / 0.86 | `package.json` |

### Profiles (`eas.json`)

| Profile | Distribution | Artifact | Dev client | `autoIncrement` | Use for |
|---------|--------------|----------|------------|-----------------|---------|
| `development` | internal | apk | **yes** (needs `expo-dev-client` — not installed) | no | dev client (after adding the pkg) |
| `preview` | internal | apk | no | no | **standard testable APK** |
| `production` | (default → aab) | aab | no | **yes** | Play Store release |

### Env vars baked per build

| Var | Value (preview/development) | Meaning |
|-----|------------------------------|---------|
| `EXPO_PUBLIC_API_URL` | `https://api.smartshaadi.co.in` | Core API base (Better Auth at `/api/auth`) |
| `EXPO_PUBLIC_MEDIA_URL` | `https://pub-7636b4a54e624991aabbe56292aff185.r2.dev` | Cloudflare R2 media CDN |
| `EXPO_PUBLIC_MOCK_MODE` | `true` | Mock-data feature flag |

Local `apps/mobile/.env` (`EXPO_PUBLIC_API_URL=http://localhost:4000`) is for `expo start` only; the
cloud builder ignores it.

### Key files

| File | What it holds |
|------|---------------|
| `apps/mobile/app.json` | owner, projectId, package, version, plugins, icons |
| `apps/mobile/eas.json` | build profiles + baked env |
| `apps/mobile/package.json` | `eas-build-post-install` hook (builds 3 workspace packages) |
| `.github/workflows/eas-build.yml` | CI build (needs `EXPO_TOKEN`) |

---

## Related

- Memory: `eas-project-relink-gulaabi-clean` — the relink/quota history this doc's [§7](#7-eas-free-quota-management-the-account-relink-reality) is based on.
- Memory: `wsl-toolchain-execution` — the WSL/`wsl.exe` arg-mangling gotcha.
- `ROADMAP.md` Phase 7 — mobile app + store-submission status.
- `docs/phase-5-8/NATIVE-SETUP-AND-ENV.md` — native-checkout dev environment setup.
