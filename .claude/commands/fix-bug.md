# SME: Fix Bug — $ARGUMENTS
# Usage: /fix-bug [description of the bug]

## Before Touching Any Code

```bash
git add -A && git commit -m "checkpoint: before fixing $ARGUMENTS"
```

If something goes wrong, we can always `git reset --hard HEAD`.

## Reproduce First

1. Write a failing Vitest test that reproduces the exact bug
2. Run `pnpm test [relevant-file]` — confirm the test fails as expected
3. Identify the root cause — do not fix symptoms

## Implement the Fix

1. Minimal change only — fix the root cause, not just the symptom
2. Check for the same bug pattern elsewhere in the codebase
3. Run `pnpm test [relevant-file]` — the failing test must now pass
4. Run `pnpm test` — no other tests should break

## Verify

1. Run `pnpm type-check` — zero TypeScript errors
2. Run `pnpm lint` — no new linting issues
3. If bug was a user-facing flow — run `pnpm e2e` for that flow

## Commit

```bash
git add -A && git commit -m "fix([area]): [description of what was wrong and what was fixed]"
```
