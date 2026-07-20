# Week 6 — Wedding Planning + Guest Management: Agent Teams Plan
# VivahOS Infinity · Phase 2 · Days 1–5
# Execution mode: Single Agent (Phase 0) → Agent Team (Phase 1 + 2) → Single Agent (Phase 3)

> Phase 2 begins. Wedding planning is the most complex module so far —
> it spans PostgreSQL (tasks, guests, invitations), MongoDB (wedding plans,
> budget, mood board), and real-time UI (Kanban board, budget tracker).
> No plan approval. Teammates plan in 3 lines then implement immediately.
> index.ts touched by single agent in Phase 3 only.

---

## Morning Checklist (7:00–8:00)

```bash
# 1. Confirm status
cat CLAUDE.md | head -30

# 2. Week target
grep -A15 "Week 6" ROADMAP.md

# 3. Update CLAUDE.md
# Phase: 2 | Week: 6 | Focus: Wedding Planning + Guest Management | Status: Starting

# 4. Infrastructure
docker compose up -d
pnpm dev

# 5. Agent Teams enabled
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # must print 1
```

---

## ─── PHASE 0: Single Agent (8:00–9:30) ──────────────────────────────────

> Shared types, schemas, MongoDB WeddingPlan model.
> Commit before any teammate spawns.

### Research prompt (8:00–8:20)

```
Read these files fully before touching anything:
- packages/db/schema/index.ts lines 488–575
  (weddings, weddingTasks, guestLists, guests, invitations tables)
- packages/types/src/index.ts    (what types exist)
- packages/schemas/src/index.ts  (what schemas exist)
- apps/api/src/index.ts          (what routers are mounted)
- docs/DATABASE.md MongoDB wedding_plans collection
- ARCHITECTURE.md (no specific wedding section — use DB docs)
- ROADMAP.md Phase 2 Week 6 items

Summarise what exists. Confirm Phase 0 jobs are correct.
Do NOT write any code yet.
```

### Phase 0 jobs (8:20–9:30)

#### Job 1 — Create `packages/types/src/wedding.ts`
```typescript
export const WeddingStatus = {
  PLANNING:   'PLANNING',
  CONFIRMED:  'CONFIRMED',
  COMPLETED:  'COMPLETED',
  CANCELLED:  'CANCELLED',
} as const
export type WeddingStatus = typeof WeddingStatus[keyof typeof WeddingStatus]

export const TaskStatus = {
  TODO:        'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE:        'DONE',
} as const
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus]

export const TaskPriority = {
  LOW:    'LOW',
  MEDIUM: 'MEDIUM',
  HIGH:   'HIGH',
} as const
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority]

export const RsvpStatus = {
  PENDING: 'PENDING',
  YES:     'YES',
  NO:      'NO',
  MAYBE:   'MAYBE',
} as const
export type RsvpStatus = typeof RsvpStatus[keyof typeof RsvpStatus]

export const MealPref = {
  VEG:     'VEG',
  NON_VEG: 'NON_VEG',
  JAIN:    'JAIN',
  VEGAN:   'VEGAN',
} as const
export type MealPref = typeof MealPref[keyof typeof MealPref]

export interface WeddingSummary {
  id:           string
  weddingDate:  string | null
  venueName:    string | null
  venueCity:    string | null
  budgetTotal:  number | null
  status:       WeddingStatus
  taskProgress: { total: number; done: number }
  guestCount:   number
}

export interface WeddingTask {
  id:          string
  weddingId:   string
  title:       string
  dueDate:     string | null
  status:      TaskStatus
  priority:    TaskPriority
  assignedTo:  string | null
  notes:       string | null
}

export interface BudgetCategory {
  name:      string
  allocated: number
  spent:     number
}

export interface WeddingPlan {
  weddingId:   string
  theme: {
    name:         string | null
    colorPalette: string[]
    style:        string | null
  }
  budget: {
    total:      number
    currency:   string
    categories: BudgetCategory[]
  }
  ceremonies: {
    type:    string
    date:    string | null
    venue:   string | null
    notes:   string | null
  }[]
  checklist: {
    item:    string
    done:    boolean
    dueDate: string | null
  }[]
  muhuratDates: {
    date:     string
    muhurat:  string
    selected: boolean
  }[]
}

export interface GuestSummary {
  id:           string
  name:         string
  phone:        string | null
  email:        string | null
  relationship: string | null
  rsvpStatus:   RsvpStatus
  mealPref:     MealPref | null
  roomNumber:   string | null
}

export interface InvitationStatus {
  guestId:  string
  sentAt:   string | null
  channel:  string | null
  openedAt: string | null
}
```

#### Job 2 — Create `packages/schemas/src/wedding.ts`
```typescript
import { z } from 'zod'

export const CreateWeddingSchema = z.object({
  weddingDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venueName:    z.string().max(255).optional(),
  venueCity:    z.string().max(100).optional(),
  budgetTotal:  z.number().positive().optional(),
})

export const UpdateWeddingSchema = CreateWeddingSchema

export const CreateTaskSchema = z.object({
  title:      z.string().min(1).max(255),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority:   z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  assignedTo: z.string().uuid().optional(),
  notes:      z.string().max(1000).optional(),
})

export const UpdateTaskSchema = z.object({
  title:      z.string().min(1).max(255).optional(),
  status:     z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority:   z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assignedTo: z.string().uuid().optional(),
  notes:      z.string().max(1000).optional(),
})

export const UpdateBudgetSchema = z.object({
  categories: z.array(z.object({
    name:      z.string().min(1).max(100),
    allocated: z.number().min(0),
    spent:     z.number().min(0),
  })),
})

export const AddGuestSchema = z.object({
  name:         z.string().min(1).max(255),
  phone:        z.string().max(15).optional(),
  email:        z.string().email().optional(),
  relationship: z.string().max(100).optional(),
  mealPref:     z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN']).optional(),
  roomNumber:   z.string().max(20).optional(),
})

export const UpdateGuestSchema = AddGuestSchema.partial().extend({
  rsvpStatus: z.enum(['PENDING', 'YES', 'NO', 'MAYBE']).optional(),
})

export const RsvpUpdateSchema = z.object({
  rsvpStatus: z.enum(['PENDING', 'YES', 'NO', 'MAYBE']),
  mealPref:   z.enum(['VEG', 'NON_VEG', 'JAIN', 'VEGAN']).optional(),
})

export const SendInvitationsSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1),
  channel:  z.enum(['EMAIL', 'SMS', 'WHATSAPP']).default('EMAIL'),
  message:  z.string().max(500).optional(),
})

export const BulkImportGuestsSchema = z.object({
  guests: z.array(AddGuestSchema).min(1).max(500),
})

export type CreateWeddingInput     = z.infer<typeof CreateWeddingSchema>
export type UpdateWeddingInput     = z.infer<typeof UpdateWeddingSchema>
export type CreateTaskInput        = z.infer<typeof CreateTaskSchema>
export type UpdateTaskInput        = z.infer<typeof UpdateTaskSchema>
export type UpdateBudgetInput      = z.infer<typeof UpdateBudgetSchema>
export type AddGuestInput          = z.infer<typeof AddGuestSchema>
export type UpdateGuestInput       = z.infer<typeof UpdateGuestSchema>
export type RsvpUpdateInput        = z.infer<typeof RsvpUpdateSchema>
export type SendInvitationsInput   = z.infer<typeof SendInvitationsSchema>
export type BulkImportGuestsInput  = z.infer<typeof BulkImportGuestsSchema>
```

#### Job 3 — Create MongoDB WeddingPlan model
Create `apps/api/src/infrastructure/mongo/models/WeddingPlan.ts`:
```typescript
import { mongoose } from '../index.js'

const BudgetCategorySchema = new mongoose.Schema({
  name:      { type: String, required: true },
  allocated: { type: Number, default: 0 },
  spent:     { type: Number, default: 0 },
})

const CeremonySchema = new mongoose.Schema({
  type:      { type: String, required: true }, // HALDI | MEHNDI | SANGEET | WEDDING | RECEPTION
  date:      { type: Date },
  venue:     { type: String },
  startTime: { type: String },
  vendorIds: [{ type: String }],
  notes:     { type: String },
})

const ChecklistItemSchema = new mongoose.Schema({
  item:    { type: String, required: true },
  done:    { type: Boolean, default: false },
  dueDate: { type: Date },
})

const MuhuratSchema = new mongoose.Schema({
  date:     { type: Date, required: true },
  muhurat:  { type: String },
  selected: { type: Boolean, default: false },
})

const WeddingPlanSchema = new mongoose.Schema({
  weddingId: { type: String, required: true, unique: true },
  theme: {
    name:         { type: String },
    colorPalette: [{ type: String }],
    style:        { type: String },
    moodBoardKeys: [{ type: String }],
  },
  budget: {
    total:      { type: Number, default: 0 },
    currency:   { type: String, default: 'INR' },
    categories: [BudgetCategorySchema],
  },
  ceremonies:    [CeremonySchema],
  checklist:     [ChecklistItemSchema],
  muhuratDates:  [MuhuratSchema],
}, { timestamps: true })

WeddingPlanSchema.index({ weddingId: 1 })

export const WeddingPlan = mongoose.model('WeddingPlan', WeddingPlanSchema)
```

#### Job 4 — Barrel exports
```
packages/types/src/index.ts   → add: export * from './wedding.js'
packages/schemas/src/index.ts → add: export * from './wedding.js'
```

#### Phase 0 commit (9:30)
```bash
pnpm --filter @vivah/types build
pnpm --filter @vivah/schemas build
pnpm type-check   # zero errors required
git add -A
git commit -m "feat(types,schemas,mongo): wedding planning shared contracts + WeddingPlan model"
git push
```

> ✅ STOP. Agent Team takes over from here.

---

## ─── PHASE 1: Agent Team — Core Build (9:30–13:00) ─────────────────────

> 3 teammates. No plan approval. Plan in 3 lines then implement.

### Team spawn prompt

```
We are building Week 6 of VivahOS Infinity — wedding planning suite
and guest management. Phase 0 is complete and committed:
- Shared types: packages/types/src/wedding.ts
- Shared schemas: packages/schemas/src/wedding.ts
- MongoDB model: apps/api/src/infrastructure/mongo/models/WeddingPlan.ts

PostgreSQL tables already exist:
- weddings, wedding_tasks, guest_lists, guests, invitations

Create an agent team with exactly 3 teammates.
NO plan approval. Each teammate writes a 3-line plan then implements immediately.

Quality bar for all teammates:
- TypeScript strict — no any
- API envelope: { success, data, error, meta } always
- All queries filtered by userId — multi-tenant safety non-negotiable
- authenticate() on every protected endpoint
- pnpm type-check must pass before marking task complete
- Git checkpoint before risky file writes
- index.ts NOT touched by any teammate — single agent mounts in Phase 3

─── TEAMMATE 1: wedding-core ─────────────────────────────────────────────
Domain: apps/api/src/weddings/
Files you OWN:
  - apps/api/src/weddings/service.ts              (CREATE)
  - apps/api/src/weddings/router.ts               (CREATE)
  - apps/api/src/weddings/__tests__/service.test.ts (CREATE)

Context — read first:
  - packages/db/schema/index.ts lines 488–530
    (weddings, weddingTasks tables + relations)
  - apps/api/src/infrastructure/mongo/models/WeddingPlan.ts
  - apps/api/src/auth/middleware.ts
  - apps/api/src/lib/response.ts
  - apps/api/src/infrastructure/redis/queues.ts
  - docs/API.md weddings section
  - ROADMAP.md Phase 2 Week 6 wedding tasks

Tasks in order:
1. service.ts — wedding management:

   createWedding(userId, input: CreateWeddingInput)
     → verify user has a profile (profiles table)
     → insert weddings row
     → create WeddingPlan document in MongoDB
       with default budget categories:
       [Venue, Catering, Decoration, Photography, Music,
        Mehendi, Makeup, Invitation, Transport, Miscellaneous]
       each with allocated: 0, spent: 0
     → return wedding with plan

   getWedding(userId, weddingId)
     → fetch from PostgreSQL + WeddingPlan from MongoDB
     → compute taskProgress: { total, done }
     → compute guestCount from guestLists
     → return WeddingSummary + plan

   updateWedding(userId, weddingId, input: UpdateWeddingInput)
     → verify ownership (wedding.profileId === profile.id)
     → update weddings row
     → return updated wedding

   updateBudget(userId, weddingId, input: UpdateBudgetInput)
     → verify ownership
     → update WeddingPlan.budget.categories in MongoDB
     → return updated budget

   getTaskBoard(userId, weddingId)
     → fetch all weddingTasks for this wedding
     → group by status: { TODO: [], IN_PROGRESS: [], DONE: [] }
     → return Kanban structure

   createTask(userId, weddingId, input: CreateTaskInput)
     → verify ownership
     → insert wedding_tasks row
     → return created task

   updateTask(userId, weddingId, taskId, input: UpdateTaskInput)
     → verify ownership
     → update wedding_tasks row
     → return updated task

   deleteTask(userId, weddingId, taskId)
     → verify ownership
     → delete wedding_tasks row

   autoGenerateChecklist(weddingId, weddingDate: string)
     → generates default tasks based on months until wedding date:
       12+ months: Book venue, Choose photographer, Set budget
       6-12 months: Send save-the-dates, Book caterer, Choose decoration
       3-6 months: Send invitations, Book music, Finalize menu
       1-3 months: Confirm all vendors, Guest list final, Room allocation
       < 1 month: Final payments, Day-of timeline, Emergency contacts
     → bulk insert into wedding_tasks
     → return count of tasks created

2. Write service.test.ts BEFORE implementing:
   - createWedding: creates both PG row and MongoDB doc
   - getWedding: returns combined data with taskProgress
   - updateBudget: MongoDB categories updated correctly
   - getTaskBoard: groups tasks by status correctly
   - autoGenerateChecklist: correct tasks for 6-month window

3. router.ts — all endpoints (all authenticate()):
   POST /weddings                         → createWedding
   GET  /weddings/:id                     → getWedding
   PUT  /weddings/:id                     → updateWedding
   GET  /weddings/:id/tasks               → getTaskBoard
   POST /weddings/:id/tasks               → createTask
   PUT  /weddings/:id/tasks/:taskId       → updateTask
   DELETE /weddings/:id/tasks/:taskId     → deleteTask
   PUT  /weddings/:id/budget              → updateBudget
   POST /weddings/:id/checklist/generate  → autoGenerateChecklist

4. pnpm type-check && pnpm --filter @vivah/api test
5. Commit: feat(weddings): wedding plan + task board + budget tracker + auto-checklist

─── TEAMMATE 2: guest-management ─────────────────────────────────────────
Domain: apps/api/src/guests/
Files you OWN:
  - apps/api/src/guests/service.ts              (CREATE)
  - apps/api/src/guests/router.ts               (CREATE)
  - apps/api/src/guests/invitation.ts           (CREATE)
  - apps/api/src/guests/__tests__/service.test.ts (CREATE)

Context — read first:
  - packages/db/schema/index.ts lines 532–575
    (guestLists, guests, invitations tables)
  - apps/api/src/lib/env.ts (USE_MOCK_SERVICES flag)
  - apps/api/src/lib/response.ts
  - docs/API.md guests section
  - docs/DATABASE.md guests collection

Tasks in order:
1. service.ts — guest management:

   getGuestList(userId, weddingId)
     → verify user owns wedding
     → fetch guestList record (create if not exists)
     → fetch all guests for this guestList
     → return GuestSummary[] with RSVP stats:
       { total, confirmed, declined, pending, maybe }

   addGuest(userId, weddingId, input: AddGuestInput)
     → verify ownership
     → ensure guestList exists (create if not)
     → insert guests row
     → return created guest

   bulkImportGuests(userId, weddingId, input: BulkImportGuestsInput)
     → verify ownership
     → ensure guestList exists
     → bulk insert guests (up to 500)
     → return { imported: number, failed: number }

   updateGuest(userId, weddingId, guestId, input: UpdateGuestInput)
     → verify ownership chain: wedding → guestList → guest
     → update guests row
     → return updated guest

   deleteGuest(userId, weddingId, guestId)
     → verify ownership
     → delete guests row (cascade deletes invitations)

   updateRsvp(guestId, token, input: RsvpUpdateInput)
     → NO auth — token-based (RSVP links in invitations)
     → verify token matches guest's invitation token
     → update guests.rsvpStatus + mealPref
     → return { success: true, guestName }

   getRsvpStats(userId, weddingId)
     → verify ownership
     → aggregate: total/yes/no/maybe/pending counts
     → meal preferences breakdown
     → room allocation status
     → return full stats object

2. invitation.ts — invitation sending (mocked):
   sendInvitations(userId, weddingId, input: SendInvitationsInput)
     → verify ownership
     → for each guestId:
       - generate unique RSVP token (crypto.randomUUID())
       - insert/update invitations row
       - if USE_MOCK_SERVICES=true:
           console.log(`[MOCK] Invitation sent to guest ${guestId} via ${channel}`)
           mark sentAt = now()
       - if real: TODO — wire to AWS SES/MSG91
     → return { sent: number, failed: number }

   RSVP link format: https://smartshaadi.co.in/rsvp/{token}

3. Write service.test.ts:
   - addGuest: creates guestList if not exists
   - bulkImportGuests: respects 500 limit
   - updateRsvp: wrong token rejected
   - getRsvpStats: correct aggregation
   - sendInvitations: mock mode logs, sets sentAt

4. router.ts — all endpoints:
   GET  /weddings/:id/guests              → getGuestList (authenticate())
   POST /weddings/:id/guests              → addGuest (authenticate())
   POST /weddings/:id/guests/bulk         → bulkImportGuests (authenticate())
   PUT  /weddings/:id/guests/:guestId     → updateGuest (authenticate())
   DELETE /weddings/:id/guests/:guestId   → deleteGuest (authenticate())
   POST /weddings/:id/invitations/send    → sendInvitations (authenticate())
   GET  /weddings/:id/guests/stats        → getRsvpStats (authenticate())
   PUT  /rsvp/:token                      → updateRsvp (NO auth — public endpoint)

5. pnpm type-check && pnpm --filter @vivah/api test
6. Commit: feat(guests): guest list + RSVP tracking + invitation flow + bulk import

─── TEAMMATE 3: wedding-ui ───────────────────────────────────────────────
Domain: apps/web/src/app/(app)/weddings/ + components
Files you OWN:
  - apps/web/src/app/(app)/weddings/page.tsx          (CREATE)
  - apps/web/src/app/(app)/weddings/new/page.tsx      (CREATE)
  - apps/web/src/app/(app)/weddings/[id]/page.tsx     (CREATE)
  - apps/web/src/app/(app)/weddings/[id]/tasks/page.tsx (CREATE)
  - apps/web/src/app/(app)/weddings/[id]/guests/page.tsx (CREATE)
  - apps/web/src/app/(app)/weddings/[id]/budget/page.tsx (CREATE)
  - apps/web/src/app/(app)/weddings/[id]/loading.tsx  (CREATE)
  - apps/web/src/components/wedding/WeddingCard.tsx   (CREATE)
  - apps/web/src/components/wedding/TaskKanban.client.tsx (CREATE)
  - apps/web/src/components/wedding/BudgetTracker.tsx (CREATE)
  - apps/web/src/components/wedding/GuestTable.client.tsx (CREATE)
  - apps/web/src/components/wedding/RsvpStats.tsx     (CREATE)

Context — read first:
  - .claude/commands/ui-component.md (design system — FOLLOW EXACTLY)
  - packages/types/src/wedding.ts (all types)
  - apps/web/src/app/(app)/dashboard/page.tsx (reference for style)

Design system (non-negotiable):
  Background:  #FEFAF6 Warm Ivory
  Headings:    Playfair Display + #7B2D42 Royal Burgundy
  CTAs:        #0E7C7B Peacock Teal
  Accents:     #C5A47E Warm Gold
  Cards:       bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm
  Touch targets: min-h-[44px] always

Tasks in order:

1. weddings/page.tsx — Server Component:
   - Fetch user's weddings from GET /api/v1/weddings
   - If no wedding: empty state with "Plan Your Wedding" CTA
     → links to /weddings/new
   - If wedding exists: WeddingCard showing date, venue, progress

2. weddings/new/page.tsx — Client Component:
   - Simple form: Wedding Date, Venue Name, City, Budget
   - POST to /api/v1/weddings on submit
   - On success → redirect to /weddings/:id
   - Warm, auspicious tone — "Begin Your Journey" not "Create Wedding"

3. weddings/[id]/page.tsx — Server Component (overview):
   - Wedding header: date, venue, days until wedding countdown
   - 4 stat cards: Tasks Done, Budget Used, Guests Confirmed, Days Left
   - Tab navigation: Overview | Tasks | Budget | Guests
   - Quick links to each section

4. weddings/[id]/tasks/page.tsx — with TaskKanban.client.tsx:
   TaskKanban is a Client Component ('use client'):
   - 3 columns: To Do | In Progress | Done
   - Each card shows: title, due date, priority badge
   - Priority colours: HIGH=Burgundy, MEDIUM=Gold, LOW=gray
   - "Add Task" button per column → inline form
   - Drag between columns updates task status via PUT API
   - If no drag library: use click-to-move buttons (← →)
   - Empty column state: dashed border with "No tasks here"

5. weddings/[id]/budget/page.tsx — with BudgetTracker.tsx:
   BudgetTracker is a Server Component:
   - Total budget at top: ₹X of ₹Y used (progress bar, Gold fill)
   - Category breakdown table:
     | Category | Allocated | Spent | Remaining | % Used |
   - Each row: inline edit for allocated amount (Client Component)
   - Over-budget warning: text-red-600 when spent > allocated
   - Add category button → adds row to MongoDB

6. weddings/[id]/guests/page.tsx — with GuestTable + RsvpStats:
   RsvpStats (Server Component):
   - 5 badges: Total | Confirmed | Declined | Maybe | Pending
   - Colours: Confirmed=Teal, Declined=red, Maybe=Gold, Pending=gray
   - Meal preference donut chart (simple CSS, no chart library)

   GuestTable (Client Component):
   - Sortable columns: Name | RSVP | Meal Pref | Room
   - Each row: edit inline (RSVP status dropdown, meal pref)
   - "Add Guest" button → modal form
   - "Send Invitations" button → selects guests → POST send
   - "Import CSV" button → paste names → bulk import
   - Mobile: card layout per guest, not table

7. loading.tsx: skeleton for wedding overview page

8. Add wedding link to AppNav:
   File: apps/web/src/components/layout/AppNav.client.tsx
   Add "My Wedding" tab with cake icon (lucide: Cake)
   Show for INDIVIDUAL role only

9. pnpm --filter @vivah/web build → zero errors
10. Commit: feat(wedding-ui): wedding planner + task kanban + budget tracker + guest table

─── SHARED RULES ─────────────────────────────────────────────────────────
- Never touch a file owned by another teammate
- index.ts: single agent mounts all routers in Phase 3
- /compact when context hits 70%
- Mark task complete immediately after commit
- No plan approval — implement immediately after 3-line plan
```

---

## ─── PHASE 2: Integration + Enhancements (14:00–16:30) ─────────────────

> Single agent. Shut team down first.

### Shutdown prompt
```
Ask all teammates to shut down gracefully. Clean up the team.
```

### Phase 2 single agent prompt
```
Read the plan at docs/superpowers/plans/2026-week6-wedding-agent-teams.md
Phase 2 tasks:

1. Mount all routers in apps/api/src/index.ts:
   import { weddingRouter } from './weddings/router.js'
   import { guestRouter }   from './guests/router.js'
   app.use('/api/v1/weddings', weddingRouter)
   app.use('/api/v1', guestRouter)  // guests nested under weddings + public /rsvp

2. Wire wedding to dashboard:
   In apps/web/src/app/(app)/dashboard/page.tsx:
   - Add "My Wedding" section below stat cards
   - If wedding exists: show WeddingCard (date, countdown, task progress)
   - If no wedding: show "Start Planning" CTA → /weddings/new

3. Add default budget auto-generation in createWedding:
   When weddingDate is provided, call autoGenerateChecklist automatically.
   User gets a head start without having to manually generate tasks.

4. Wire RSVP public endpoint:
   Confirm /rsvp/:token route is mounted without authenticate()
   Test: curl -X PUT http://localhost:4000/api/v1/rsvp/mock-token \
     -H "Content-Type: application/json" \
     -d '{"rsvpStatus":"YES","mealPref":"VEG"}'
   Should return { success: true } (mock token returns graceful error)

5. Smoke test checklist:
   □ POST /api/v1/weddings → 201, wedding + MongoDB plan created
   □ GET  /api/v1/weddings/:id → 200, returns PG + MongoDB combined
   □ POST /api/v1/weddings/:id/tasks → 201, task created
   □ GET  /api/v1/weddings/:id/tasks → 200, kanban groups correct
   □ PUT  /api/v1/weddings/:id/tasks/:taskId → 200, status updated
   □ PUT  /api/v1/weddings/:id/budget → 200, MongoDB categories updated
   □ POST /api/v1/weddings/:id/guests → 201, guest created
   □ POST /api/v1/weddings/:id/guests/bulk → 201, bulk import works
   □ GET  /api/v1/weddings/:id/guests/stats → 200, RSVP stats correct
   □ POST /api/v1/weddings/:id/invitations/send → 200, mock logs printed
   □ PUT  /api/v1/rsvp/:token → graceful handling
   □ Web: /weddings → loads, empty state shows
   □ Web: /weddings/new → form loads, submits, redirects
   □ Web: /weddings/:id → overview loads with stats
   □ Web: /weddings/:id/tasks → Kanban renders
   □ Web: /weddings/:id/budget → budget table renders
   □ Web: /weddings/:id/guests → guest table + RSVP stats

6. Document results: docs/smoke-test-week6.md

7. pnpm type-check && pnpm test
   Must maintain 182/182 minimum — zero regressions

8. Commit: feat(weddings): week 6 integration — wedding suite fully wired
```

---

## ─── Session End (17:30–18:00) ──────────────────────────────────────────

```bash
pnpm type-check && pnpm test

git add -A
git commit -m "feat(weddings,guests): week 6 complete — wedding planning + guest management"
git push
```

Update ROADMAP.md — mark done:
```
✅ Wedding plan creation (date, venue, style, theme, couple link)
✅ Budget tracker by category
✅ Kanban task board (auto-checklist from wedding date)
✅ Guest list management (manual + bulk import)
✅ RSVP tracking (yes/no/maybe)
✅ Meal preference collection
✅ Invitation delivery (mocked — email/SMS activates after registration)
```

Add blocker notes:
```
[2026-week6] Real invitation delivery needs AWS SES + MSG91
[2026-week6] Room allocation UI deferred to Week 7
[2026-week6] Mood board (R2 photo upload) deferred to Week 7
[2026-week6] Muhurat date selector needs horoscope integration
```

Update CLAUDE.md:
```
Phase:  2
Week:   7
Focus:  Video Calls + Escrow + Rental Module
Status: Starting
```

---

## File Ownership Map

| File | Owner | Phase |
|------|-------|-------|
| `packages/types/src/wedding.ts` | Single agent | Phase 0 |
| `packages/schemas/src/wedding.ts` | Single agent | Phase 0 |
| `infrastructure/mongo/models/WeddingPlan.ts` | Single agent | Phase 0 |
| `weddings/service.ts + router.ts` | Teammate 1 | Phase 1 |
| `weddings/__tests__/` | Teammate 1 | Phase 1 |
| `guests/service.ts + router.ts + invitation.ts` | Teammate 2 | Phase 1 |
| `guests/__tests__/` | Teammate 2 | Phase 1 |
| `web/app/(app)/weddings/` | Teammate 3 | Phase 1 |
| `web/components/wedding/` | Teammate 3 | Phase 1 |
| `apps/api/src/index.ts` | Single agent | Phase 2 only |
| `web/app/(app)/dashboard/page.tsx` | Single agent | Phase 2 only |

---

## Dependency Chain

```
Phase 0 (single agent)
  └── types + schemas + WeddingPlan model committed
        ├── Teammate 1 (wedding-core) — independent, starts immediately
        ├── Teammate 2 (guest-management) — independent, starts immediately
        └── Teammate 3 (wedding-ui) — independent, starts immediately
              └── Phase 2 single agent:
                    - Mount routers
                    - Wire dashboard
                    - Smoke test
```

---

## Test Coverage Requirements

| Module | Required | Key Cases |
|--------|----------|-----------|
| `weddings/service.ts` | 85%+ | PG+MongoDB creation, ownership verify, task grouping |
| `guests/service.ts` | 85%+ | GuestList auto-create, bulk limit, RSVP token verify |
| `guests/invitation.ts` | 80%+ | Mock mode logs, sentAt set, token generated |
| Wedding UI components | Visual | 375px mobile, 44px targets, Ivory bg, Teal CTAs |

---

## WSL Agent Teams Rules

```
✅ No plan approval — plan in 3 lines then implement
✅ If teammate goes idle — respawn: "claim your tasks, no plan mode"
✅ index.ts single agent only in Phase 2
✅ 3 teammates max on Max 5x budget
✅ /compact at 70% context
✅ watch -n 3 "ls -la [dir]" in second terminal for file activity
```

---

## Key Design Decisions

```
Kanban without drag library:
  If no drag-and-drop library is available, use click-to-move
  buttons (← Move Left | Move Right →) per task card.
  This avoids adding @dnd-kit or react-beautiful-dnd which
  add significant bundle size. Add drag in Week 7 polish.

RSVP tokens:
  crypto.randomUUID() — no external dependency.
  Store in invitations.sentAt column context.
  Public endpoint /rsvp/:token requires NO auth.

Budget categories:
  Stored in MongoDB (flexible schema — categories can be added/removed).
  Totals derived in-memory — no separate aggregation table needed.

Auto-checklist timing:
  Based on months until weddingDate.
  If no weddingDate set → generate generic 50-item checklist.
  Tasks inserted with correct dueDate relative to weddingDate.
```
