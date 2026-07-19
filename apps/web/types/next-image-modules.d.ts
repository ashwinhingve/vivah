// Tracked counterpart to the auto-generated (and gitignored) `next-env.d.ts`.
//
// `next-env.d.ts` is what pulls in `next/image-types/global`, which declares the
// `*.webp` / `*.png` / `*.svg` module shapes used by static image imports. Next
// regenerates it on `next dev` / `next build`, and Next's own recommended
// .gitignore excludes it — so it exists on developer machines but never in a
// fresh CI checkout. `pnpm type-check` runs before any Next build, which made
// every static image import fail with TS2307 in CI while passing locally.
//
// Keeping these reference directives in a tracked file makes type-check
// self-sufficient. Duplicating them alongside next-env.d.ts is harmless.
/// <reference types="next" />
/// <reference types="next/image-types/global" />
