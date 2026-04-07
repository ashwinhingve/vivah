# SME: Build New Module — $ARGUMENTS
# Usage: /new-module [module-name] [description]

## Before Writing Any Code

1. Read all related existing files in the relevant `apps/api/modules/` or `apps/web/` directory.
2. Check `CLAUDE.md` — confirm this module follows all architecture rules.
3. Check `ROADMAP.md` — find this module and note which phase it belongs to.
4. Summarise what already exists before proposing anything.

## Planning (Do Not Skip)

Write a detailed implementation plan covering:
- Files to CREATE (with exact paths)
- Files to MODIFY (with reason)
- Database changes required (Drizzle schema additions)
- API endpoints needed (method, path, auth requirement)
- Breaking changes or risks
- Third-party APIs or services involved

**Wait for confirmation before writing a single line of implementation code.**

## Implementation

After plan is confirmed:
1. Create all files with full TypeScript types — no `any`, no shortcuts
2. Follow all conventions in `CLAUDE.md`
3. All database queries in `packages/db/` — never inline
4. All LLM calls routed through `apps/ai-service/` — never direct
5. Server Actions for mutations in `apps/web/` — no API routes

## Testing

1. Write Vitest unit tests for all business logic in this module
2. Write at least one Playwright E2E test for the primary user flow
3. Run `pnpm test` — all tests must pass before completion
4. Run `pnpm type-check` — zero TypeScript errors

## Completion

1. Run `pnpm lint` — fix all issues
2. Update `ROADMAP.md` — mark this module as complete
3. Update `CLAUDE.md` current status if phase changed
4. Commit: `git add -A && git commit -m "feat([module]): [description]"`
