/**
 * Smart Shaadi — Weddings Service
 *
 * createWedding       — create wedding row (PG) + WeddingPlan doc (Mongo)
 * getWedding          — fetch combined PG + Mongo data with task progress
 * updateWedding       — update wedding metadata (owner only)
 * updateBudget        — update budget categories in MongoDB (owner only)
 * getTaskBoard        — fetch tasks grouped by status (Kanban)
 * createTask          — insert a wedding_tasks row (owner only)
 * updateTask          — update a wedding_tasks row (owner only)
 * deleteTask          — delete a wedding_tasks row (owner only)
 * autoGenerateChecklist — bulk-insert default tasks by months-until-wedding
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { weddings, weddingTasks, profiles, guestLists, ceremonies } from '@smartshaadi/db';
import { WeddingPlan } from '../infrastructure/mongo/models/WeddingPlan.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';
import type {
  WeddingSummary,
  WeddingTask,
  WeddingPlan as WeddingPlanType,
  BudgetCategory,
  Ceremony,
  MuhuratDate,
} from '@smartshaadi/types';
import type {
  CreateWeddingInput,
  UpdateWeddingInput,
  CreateTaskInput,
  UpdateTaskInput,
  UpdateBudgetInput,
  CreateCeremonyInput,
  UpdateCeremonyInput,
  SelectMuhuratInput,
} from '@smartshaadi/schemas';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_BUDGET_CATEGORIES: BudgetCategory[] = [
  { name: 'Venue',         allocated: 0, spent: 0 },
  { name: 'Catering',      allocated: 0, spent: 0 },
  { name: 'Decoration',    allocated: 0, spent: 0 },
  { name: 'Photography',   allocated: 0, spent: 0 },
  { name: 'Music',         allocated: 0, spent: 0 },
  { name: 'Mehendi',       allocated: 0, spent: 0 },
  { name: 'Makeup',        allocated: 0, spent: 0 },
  { name: 'Invitation',    allocated: 0, spent: 0 },
  { name: 'Transport',     allocated: 0, spent: 0 },
  { name: 'Miscellaneous', allocated: 0, spent: 0 },
];

// ── Internal types ─────────────────────────────────────────────────────────────

type WeddingRow    = typeof weddings.$inferSelect;
type TaskRow       = typeof weddingTasks.$inferSelect;

interface TaskBoard {
  TODO:        WeddingTask[];
  IN_PROGRESS: WeddingTask[];
  DONE:        WeddingTask[];
}

// ── Mock helpers ───────────────────────────────────────────────────────────────

/** Key used by mockStore for a given wedding's WeddingPlan doc. */
function planKey(weddingId: string): string {
  return `wedding_plan:${weddingId}`;
}

function mockGetPlan(weddingId: string): WeddingPlanType | null {
  const raw = mockGet(planKey(weddingId));
  if (!raw) return null;
  const plan = (raw as { plan?: unknown }).plan ?? raw;
  return plan as WeddingPlanType;
}

function mockSavePlan(weddingId: string, plan: WeddingPlanType): WeddingPlanType {
  mockUpsertField(planKey(weddingId), 'plan', plan);
  const saved = mockGet(planKey(weddingId));
  return (saved?.['plan'] ?? plan) as WeddingPlanType;
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function mapTaskRow(row: TaskRow): WeddingTask {
  return {
    id:         row.id,
    weddingId:  row.weddingId,
    title:      row.title,
    dueDate:    row.dueDate ?? null,
    status:     row.status as WeddingTask['status'],
    priority:   row.priority as WeddingTask['priority'],
    assignedTo: row.assignedTo ?? null,
    notes:      row.description ?? null,
  };
}

// ── createWedding ─────────────────────────────────────────────────────────────

export async function createWedding(
  userId: string,
  input: CreateWeddingInput,
): Promise<{ wedding: WeddingRow; plan: WeddingPlanType; tasksCreated: number }> {
  // Resolve profileId from userId
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  // Insert PostgreSQL row
  const [weddingRow] = await db
    .insert(weddings)
    .values({
      profileId:   profile.id,
      weddingDate: input.weddingDate ?? null,
      venueName:   input.venueName ?? null,
      venueCity:   input.venueCity ?? null,
      budgetTotal: input.budgetTotal != null ? String(input.budgetTotal) : null,
      status:      'PLANNING',
    })
    .returning();

  if (!weddingRow) {
    throw new Error('WEDDING_CREATE_FAILED');
  }

  const defaultPlan: WeddingPlanType = {
    weddingId:   weddingRow.id,
    theme: {
      name:         null,
      colorPalette: [],
      style:        null,
    },
    budget: {
      total:      input.budgetTotal ?? 0,
      currency:   'INR',
      categories: DEFAULT_BUDGET_CATEGORIES,
    },
    ceremonies:   [],
    checklist:    [],
    muhuratDates: [],
  };

  let plan: WeddingPlanType;

  if (env.USE_MOCK_SERVICES) {
    plan = mockSavePlan(weddingRow.id, defaultPlan);
  } else {
    const doc = await WeddingPlan.create({
      weddingId:  weddingRow.id,
      theme:      defaultPlan.theme,
      budget: {
        total:      defaultPlan.budget.total,
        currency:   defaultPlan.budget.currency,
        categories: defaultPlan.budget.categories,
      },
      ceremonies:   [],
      checklist:    [],
      muhuratDates: [],
    });
    // Update PG row with mongo doc id
    await db
      .update(weddings)
      .set({ mongoWeddingPlanId: (doc._id as { toString(): string }).toString() })
      .where(eq(weddings.id, weddingRow.id));
    plan = defaultPlan;
  }

  let tasksCreated = 0;
  if (input.weddingDate) {
    try {
      const result = await autoGenerateChecklist(userId, weddingRow.id, input.weddingDate);
      tasksCreated = result.created;
    } catch {
      // non-fatal — user can generate later via explicit endpoint
    }
  }

  return { wedding: weddingRow, plan, tasksCreated };
}

// ── listUserWeddings ───────────────────────────────────────────────────────────

export async function listUserWeddings(
  userId: string,
): Promise<WeddingSummary[]> {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) return [];

  const rows = await db
    .select()
    .from(weddings)
    .where(eq(weddings.profileId, profile.id));

  if (rows.length === 0) return [];

  const results: WeddingSummary[] = [];
  for (const row of rows) {
    const tasks = await db
      .select({ status: weddingTasks.status })
      .from(weddingTasks)
      .where(eq(weddingTasks.weddingId, row.id));

    results.push({
      id:          row.id,
      weddingDate: row.weddingDate ?? null,
      venueName:   row.venueName,
      venueCity:   row.venueCity,
      budgetTotal: row.budgetTotal != null ? Number(row.budgetTotal) : null,
      status:      row.status as WeddingSummary['status'],
      taskProgress: {
        total: tasks.length,
        done:  tasks.filter((t) => t.status === 'DONE').length,
      },
      guestCount:  row.guestCount ?? 0,
    });
  }

  return results;
}

// ── getWedding ─────────────────────────────────────────────────────────────────

export async function getWedding(
  userId: string,
  weddingId: string,
): Promise<(WeddingSummary & { plan: WeddingPlanType | null }) | null> {
  // Verify ownership/access
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) return null;

  const [row] = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.id, weddingId), eq(weddings.profileId, profile.id)))
    .limit(1);

  if (!row) return null;

  // Task progress
  const tasks = await db
    .select({ status: weddingTasks.status })
    .from(weddingTasks)
    .where(eq(weddingTasks.weddingId, weddingId));

  const taskProgress = {
    total: tasks.length,
    done:  tasks.filter((t) => t.status === 'DONE').length,
  };

  // Guest count
  const [guestListRow] = await db
    .select({ id: guestLists.id })
    .from(guestLists)
    .where(eq(guestLists.weddingId, weddingId))
    .limit(1);

  const guestCount = guestListRow ? row.guestCount ?? 0 : 0;

  // Fetch MongoDB plan
  let plan: WeddingPlanType | null = null;

  if (env.USE_MOCK_SERVICES) {
    plan = mockGetPlan(weddingId);
  } else {
    const doc = await WeddingPlan.findOne({ weddingId }).lean();
    if (doc) {
      plan = {
        weddingId: doc.weddingId,
        theme: {
          name:         (doc.theme?.name as string | undefined) ?? null,
          colorPalette: (doc.theme?.colorPalette as string[] | undefined) ?? [],
          style:        (doc.theme?.style as string | undefined) ?? null,
        },
        budget: {
          total:      (doc.budget?.total as number | undefined) ?? 0,
          currency:   (doc.budget?.currency as string | undefined) ?? 'INR',
          categories: ((doc.budget?.categories ?? []) as BudgetCategory[]),
        },
        ceremonies:   [],
        checklist:    [],
        muhuratDates: [],
      };
    }
  }

  const summary: WeddingSummary & { plan: WeddingPlanType | null } = {
    id:          row.id,
    weddingDate: row.weddingDate ?? null,
    venueName:   row.venueName ?? null,
    venueCity:   row.venueCity ?? null,
    budgetTotal: row.budgetTotal != null ? parseFloat(row.budgetTotal) : null,
    status:      row.status as WeddingSummary['status'],
    taskProgress,
    guestCount,
    plan,
  };

  return summary;
}

// ── updateWedding ─────────────────────────────────────────────────────────────

export async function updateWedding(
  userId: string,
  weddingId: string,
  input: UpdateWeddingInput,
): Promise<WeddingRow | null> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) return null;

  const updates: Partial<WeddingRow> = {};
  if (input.weddingDate !== undefined) updates.weddingDate = input.weddingDate ?? null;
  if (input.venueName   !== undefined) updates.venueName   = input.venueName   ?? null;
  if (input.venueCity   !== undefined) updates.venueCity   = input.venueCity   ?? null;
  if (input.budgetTotal !== undefined) {
    updates.budgetTotal = input.budgetTotal != null ? String(input.budgetTotal) : null;
  }
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(weddings)
    .set(updates)
    .where(and(eq(weddings.id, weddingId), eq(weddings.profileId, row.profileId)))
    .returning();

  return updated ?? null;
}

// ── updateBudget ──────────────────────────────────────────────────────────────

export async function updateBudget(
  userId: string,
  weddingId: string,
  input: UpdateBudgetInput,
): Promise<BudgetCategory[]> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) throw new Error('WEDDING_NOT_FOUND');

  if (env.USE_MOCK_SERVICES) {
    const existing = mockGetPlan(weddingId);
    const plan: WeddingPlanType = existing ?? {
      weddingId,
      theme: { name: null, colorPalette: [], style: null },
      budget: { total: 0, currency: 'INR', categories: input.categories },
      ceremonies: [],
      checklist: [],
      muhuratDates: [],
    };
    plan.budget.categories = input.categories;
    mockSavePlan(weddingId, plan);
    return input.categories;
  } else {
    await WeddingPlan.findOneAndUpdate(
      { weddingId },
      { $set: { 'budget.categories': input.categories } },
      { new: true },
    );
    return input.categories;
  }
}

// ── getTaskBoard ──────────────────────────────────────────────────────────────

export async function getTaskBoard(
  userId: string,
  weddingId: string,
): Promise<TaskBoard | null> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) return null;

  const taskRows = await db
    .select()
    .from(weddingTasks)
    .where(eq(weddingTasks.weddingId, weddingId));

  const board: TaskBoard = { TODO: [], IN_PROGRESS: [], DONE: [] };

  for (const t of taskRows) {
    const task = mapTaskRow(t);
    if (t.status === 'DONE') {
      board.DONE.push(task);
    } else if (t.status === 'IN_PROGRESS') {
      board.IN_PROGRESS.push(task);
    } else {
      board.TODO.push(task);
    }
  }

  return board;
}

// ── createTask ────────────────────────────────────────────────────────────────

export async function createTask(
  userId: string,
  weddingId: string,
  input: CreateTaskInput,
): Promise<WeddingTask> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) throw new Error('WEDDING_NOT_FOUND');

  const [task] = await db
    .insert(weddingTasks)
    .values({
      weddingId,
      title:       input.title,
      description: input.notes ?? null,
      dueDate:     input.dueDate ?? null,
      status:      'TODO',
      priority:    input.priority,
      assignedTo:  input.assignedTo ?? null,
    })
    .returning();

  if (!task) throw new Error('TASK_CREATE_FAILED');

  return mapTaskRow(task);
}

// ── updateTask ────────────────────────────────────────────────────────────────

export async function updateTask(
  userId: string,
  weddingId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<WeddingTask | null> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) return null;

  const updates: Partial<TaskRow> = { updatedAt: new Date() };
  if (input.title      !== undefined) updates.title       = input.title;
  if (input.status     !== undefined) updates.status      = input.status;
  if (input.dueDate    !== undefined) updates.dueDate     = input.dueDate ?? null;
  if (input.priority   !== undefined) updates.priority    = input.priority;
  if (input.assignedTo !== undefined) updates.assignedTo  = input.assignedTo ?? null;
  if (input.notes      !== undefined) updates.description = input.notes ?? null;

  const [updated] = await db
    .update(weddingTasks)
    .set(updates)
    .where(and(eq(weddingTasks.id, taskId), eq(weddingTasks.weddingId, weddingId)))
    .returning();

  return updated ? mapTaskRow(updated) : null;
}

// ── deleteTask ────────────────────────────────────────────────────────────────

export async function deleteTask(
  userId: string,
  weddingId: string,
  taskId: string,
): Promise<boolean> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) return false;

  const deleted = await db
    .delete(weddingTasks)
    .where(and(eq(weddingTasks.id, taskId), eq(weddingTasks.weddingId, weddingId)))
    .returning({ id: weddingTasks.id });

  return deleted.length > 0;
}

// ── autoGenerateChecklist ─────────────────────────────────────────────────────

const CHECKLIST_BUCKETS: { minMonths: number; maxMonths: number; tasks: string[] }[] = [
  {
    minMonths: 12,
    maxMonths: Infinity,
    tasks: ['Book venue', 'Choose photographer', 'Set budget'],
  },
  {
    minMonths: 6,
    maxMonths: 12,
    tasks: ['Send save-the-dates', 'Book caterer', 'Choose decoration'],
  },
  {
    minMonths: 3,
    maxMonths: 6,
    tasks: ['Send invitations', 'Book music', 'Finalize menu'],
  },
  {
    minMonths: 1,
    maxMonths: 3,
    tasks: ['Confirm all vendors', 'Guest list final', 'Room allocation'],
  },
  {
    minMonths: 0,
    maxMonths: 1,
    tasks: ['Final payments', 'Day-of timeline', 'Emergency contacts'],
  },
];

export async function autoGenerateChecklist(
  userId: string,
  weddingId: string,
  weddingDate: string,
): Promise<{ created: number }> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) throw new Error('WEDDING_NOT_FOUND');

  const targetDate = new Date(weddingDate);
  const now        = new Date();
  const monthsUntil =
    (targetDate.getFullYear() - now.getFullYear()) * 12 +
    (targetDate.getMonth() - now.getMonth());

  // Collect tasks applicable for the current window
  const tasksToInsert: string[] = [];
  for (const bucket of CHECKLIST_BUCKETS) {
    if (monthsUntil >= bucket.minMonths && monthsUntil < bucket.maxMonths) {
      tasksToInsert.push(...bucket.tasks);
    }
  }

  if (tasksToInsert.length === 0) return { created: 0 };

  const rows = await db
    .insert(weddingTasks)
    .values(
      tasksToInsert.map((title) => ({
        weddingId,
        title,
        status:   'TODO' as const,
        priority: 'MEDIUM' as const,
      })),
    )
    .returning({ id: weddingTasks.id });

  return { created: rows.length };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function resolveOwnedWedding(
  userId: string,
  weddingId: string,
): Promise<WeddingRow | null> {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) return null;

  const [row] = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.id, weddingId), eq(weddings.profileId, profile.id)))
    .limit(1);

  return row ?? null;
}


// ── Internal row mapper ────────────────────────────────────────────────────────

type CeremonyRow = typeof ceremonies.$inferSelect;

function mapCeremonyRow(row: CeremonyRow): Ceremony {
  return {
    id:             row.id,
    weddingId:      row.weddingId,
    type:           row.type as Ceremony['type'],
    status:         row.status as Ceremony['status'],
    date:           row.date ?? null,
    venue:          row.venue ?? null,
    venueAddress:   row.venueAddress ?? null,
    startTime:      row.startTime ?? null,
    endTime:        row.endTime ?? null,
    dressCode:      row.dressCode ?? null,
    expectedGuests: row.expectedGuests ?? null,
    isPublic:       row.isPublic,
    notes:          row.notes ?? null,
    startedAt:      row.startedAt ? row.startedAt.toISOString() : null,
    completedAt:    row.completedAt ? row.completedAt.toISOString() : null,
  };
}

// ── addCeremony ───────────────────────────────────────────────────────────────

export async function addCeremony(
  userId: string,
  weddingId: string,
  input: CreateCeremonyInput,
): Promise<Ceremony> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) throw new Error('WEDDING_NOT_FOUND');

  const [inserted] = await db
    .insert(ceremonies)
    .values({
      weddingId,
      type:      input.type,
      date:      input.date ?? null,
      venue:     input.venue ?? null,
      startTime: input.startTime ?? null,
      endTime:   input.endTime ?? null,
      notes:     input.notes ?? null,
    })
    .returning();

  if (!inserted) throw new Error('CEREMONY_CREATE_FAILED');

  const ceremony = mapCeremonyRow(inserted);

  // Sync ceremonies array to MongoDB / mockStore
  if (env.USE_MOCK_SERVICES) {
    const existing = mockGetPlan(weddingId);
    const plan: WeddingPlanType = existing ?? {
      weddingId,
      theme:       { name: null, colorPalette: [], style: null },
      budget:      { total: 0, currency: 'INR', categories: [] },
      ceremonies:  [],
      checklist:   [],
      muhuratDates: [],
    };
    plan.ceremonies = [
      ...plan.ceremonies,
      {
        type:  ceremony.type,
        date:  ceremony.date,
        venue: ceremony.venue,
        notes: ceremony.notes,
      },
    ];
    mockSavePlan(weddingId, plan);
  } else {
    await WeddingPlan.findOneAndUpdate(
      { weddingId },
      {
        $push: {
          ceremonies: {
            type:  ceremony.type,
            date:  ceremony.date,
            venue: ceremony.venue,
            notes: ceremony.notes,
          },
        },
      },
      { new: true },
    );
  }

  return ceremony;
}

// ── updateCeremony ────────────────────────────────────────────────────────────

export async function updateCeremony(
  userId: string,
  weddingId: string,
  ceremonyId: string,
  input: UpdateCeremonyInput,
): Promise<Ceremony | null> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) throw new Error('WEDDING_NOT_FOUND');

  const updates: Partial<CeremonyRow> = {};
  if (input.type      !== undefined) updates.type      = input.type;
  if (input.date      !== undefined) updates.date      = input.date ?? null;
  if (input.venue     !== undefined) updates.venue     = input.venue ?? null;
  if (input.startTime !== undefined) updates.startTime = input.startTime ?? null;
  if (input.endTime   !== undefined) updates.endTime   = input.endTime ?? null;
  if (input.notes     !== undefined) updates.notes     = input.notes ?? null;

  const [updated] = await db
    .update(ceremonies)
    .set(updates)
    .where(and(eq(ceremonies.id, ceremonyId), eq(ceremonies.weddingId, weddingId)))
    .returning();

  return updated ? mapCeremonyRow(updated) : null;
}

// ── deleteCeremony ────────────────────────────────────────────────────────────

export async function deleteCeremony(
  userId: string,
  weddingId: string,
  ceremonyId: string,
): Promise<boolean> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) return false;

  const deleted = await db
    .delete(ceremonies)
    .where(and(eq(ceremonies.id, ceremonyId), eq(ceremonies.weddingId, weddingId)))
    .returning({ id: ceremonies.id });

  return deleted.length > 0;
}

// ── getCeremonies ─────────────────────────────────────────────────────────────

export async function getCeremonies(
  userId: string,
  weddingId: string,
): Promise<Ceremony[]> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) throw new Error('WEDDING_NOT_FOUND');

  const rows = await db
    .select()
    .from(ceremonies)
    .where(eq(ceremonies.weddingId, weddingId));

  return rows.map(mapCeremonyRow);
}

// ── getMuhuratSuggestions ─────────────────────────────────────────────────────
// Deterministic mock algorithm — no LLM call, pure math.
// Generates 5 auspicious dates near weddingDate, preferring Sat/Sun.

const MUHURAT_NAMES = [
  'Brahma Muhurat',
  'Vijay Muhurat',
  'Abhijit Muhurat',
  'Amrit Siddhi Muhurat',
  'Sarvartha Siddhi Muhurat',
];

const TITHI_NAMES = [
  'Dwitiya',
  'Panchami',
  'Saptami',
  'Ekadashi',
  'Trayodashi',
];

export function getMuhuratSuggestions(weddingDate: string): MuhuratDate[] {
  const base = new Date(weddingDate);

  // Collect candidate dates: 14 days before to 14 days after
  const candidates: Date[] = [];
  for (let offset = -14; offset <= 14; offset++) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    candidates.push(d);
  }

  // Prefer Sat (6) and Sun (0) — sort by preference
  const weekendFirst = [...candidates].sort((a, b) => {
    const aIsWeekend = a.getDay() === 0 || a.getDay() === 6 ? 0 : 1;
    const bIsWeekend = b.getDay() === 0 || b.getDay() === 6 ? 0 : 1;
    return aIsWeekend - bIsWeekend;
  });

  // Pick 5 unique dates spread across the range
  const picked: Date[] = [];
  const usedIndices = new Set<number>();
  // Take first 5 unique from the weekend-first sorted list
  for (const d of weekendFirst) {
    if (picked.length >= 5) break;
    const key = d.toISOString().slice(0, 10);
    if (!usedIndices.has(new Date(key).getTime())) {
      usedIndices.add(new Date(key).getTime());
      picked.push(d);
    }
  }

  return picked.map((d, i) => ({
    date:     d.toISOString().slice(0, 10),
    muhurat:  MUHURAT_NAMES[i % MUHURAT_NAMES.length]!,
    tithi:    TITHI_NAMES[i % TITHI_NAMES.length]!,
    selected: false,
  }));
}

// ── selectMuhurat ─────────────────────────────────────────────────────────────

export async function selectMuhurat(
  userId: string,
  weddingId: string,
  input: SelectMuhuratInput,
): Promise<MuhuratDate[]> {
  const row = await resolveOwnedWedding(userId, weddingId);
  if (!row) throw new Error('WEDDING_NOT_FOUND');

  // Also update weddingDate in PostgreSQL
  await db
    .update(weddings)
    .set({ weddingDate: input.date, updatedAt: new Date() })
    .where(eq(weddings.id, weddingId));

  if (env.USE_MOCK_SERVICES) {
    const existing = mockGetPlan(weddingId);
    const plan: WeddingPlanType = existing ?? {
      weddingId,
      theme:       { name: null, colorPalette: [], style: null },
      budget:      { total: 0, currency: 'INR', categories: [] },
      ceremonies:  [],
      checklist:   [],
      muhuratDates: [],
    };

    // Mark all others deselected, matching date selected
    const currentDates = plan.muhuratDates ?? [];
    let found = false;
    const updated: MuhuratDate[] = currentDates.map((d): MuhuratDate => {
      if (d.date === input.date) {
        found = true;
        return { date: d.date, muhurat: input.muhurat, tithi: input.tithi ?? d.tithi ?? null, selected: true };
      }
      return { date: d.date, muhurat: d.muhurat, tithi: d.tithi, selected: false };
    });

    // If the date wasn't in the list, append it
    if (!found) {
      updated.push({ date: input.date, muhurat: input.muhurat, tithi: input.tithi ?? null, selected: true });
    }

    plan.muhuratDates = updated;
    mockSavePlan(weddingId, plan);
    return updated;
  } else {
    // In real mode: unset all, then set the matching one. If the date wasn't
    // among prior suggestions (no match for $.date), append it instead — mirror
    // the mock path so the user-selected date is always persisted.
    await WeddingPlan.findOneAndUpdate(
      { weddingId },
      { $set: { 'muhuratDates.$[].selected': false } },
    );
    const matched = await WeddingPlan.findOneAndUpdate(
      { weddingId, 'muhuratDates.date': input.date },
      {
        $set: {
          'muhuratDates.$.selected': true,
          'muhuratDates.$.muhurat':  input.muhurat,
          'muhuratDates.$.tithi':    input.tithi ?? null,
        },
      },
      { new: true },
    );
    if (!matched) {
      await WeddingPlan.findOneAndUpdate(
        { weddingId },
        {
          $push: {
            muhuratDates: {
              date:     input.date,
              muhurat:  input.muhurat,
              tithi:    input.tithi ?? null,
              selected: true,
            },
          },
        },
      );
    }
    const doc = await WeddingPlan.findOne({ weddingId }).lean();
    return ((doc?.muhuratDates ?? []) as MuhuratDate[]);
  }
}
