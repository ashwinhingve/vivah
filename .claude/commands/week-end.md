# SME: End of Week — No Arguments Needed
# Usage: /week-end

## Quality Gate

Run this before anything else. Fix all failures before proceeding.

```bash
pnpm type-check
pnpm lint
pnpm test
```

## ROADMAP.md Update

1. Mark all completed modules with ✅
2. Add any new blockers with today's date
3. Confirm next week's targets are correct
4. Check dependency tracker — anything overdue?

## CLAUDE.md Update

Update the current status block:
```
Phase:     [current phase]
Week:      [next week number]
Focus:     [next week's primary module]
Status:    Starting
```

## Commit & Push

```bash
git add -A
git commit -m "chore: week [N] complete — [brief summary of what shipped]"
git push origin main
```

## Verify Deploys

1. Check Vercel dashboard — web app deployed successfully
2. Check Railway dashboard — API service and AI service running
3. Open production URL — confirm no obvious errors

## Friday Loom (if applicable)

Record 5-minute Loom showing:
- What shipped this week (walk through the live feature)
- What's coming next week
- Any blockers that need client input

Post to Notion client portal.
