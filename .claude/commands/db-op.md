# SME: Database Operation — $ARGUMENTS  
# Usage: /db-op [describe what you need]
# Use for schema changes, migrations, seed data, and complex queries

## Before Any Schema Change

1. Read the current schema: `packages/db/schema/index.ts`
2. Check existing relations — understand what depends on what
3. Write the migration plan before touching any file

## Schema Changes (Drizzle)

Add to the appropriate file in `packages/db/schema/`:
- Phase 1 tables: `schema/index.ts` (already scaffolded)
- Phase 2+ tables: `schema/phase2.ts`, `schema/phase3.ts` etc.

After any schema change:
```bash
pnpm db:generate   # Generate migration file
pnpm db:push       # Apply to dev database
```

Never run `db:push` in production — use migration files only.

## Seed Data Format

All seed data goes in `packages/db/seed/`:
```typescript
// seed/users.ts — example
export const seedUsers = async (db: DrizzleDB) => {
  await db.insert(users).values([
    {
      phone: '+919999999001',
      role: 'INDIVIDUAL',
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
    {
      phone: '+919999999002',
      role: 'VENDOR',
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
    {
      phone: '+919999999003',
      role: 'ADMIN',
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
  ]).onConflictDoNothing();
};
```

## Query Conventions

```typescript
// ✅ Always filter by relevant ID — never return all records
const userBookings = await db
  .select()
  .from(bookings)
  .where(eq(bookings.customerId, userId))
  .orderBy(desc(bookings.createdAt))
  .limit(20);

// ✅ Use transactions for multi-table writes
await db.transaction(async (tx) => {
  const [booking] = await tx.insert(bookings).values(data).returning();
  await tx.insert(auditLogs).values({
    eventType: 'BOOKING_CONFIRMED',
    entityType: 'booking',
    entityId: booking.id,
    // ...
  });
});

// ❌ Never raw SQL for user input
// ❌ Never select * without .limit() on large tables
// ❌ Never bypass relations — use Drizzle's relational queries
```

## MongoDB Operations

All MongoDB queries in `apps/api/infrastructure/mongo/repositories/`:
```typescript
// Never inline Mongoose queries in route handlers
// Always go through repository pattern
import { ProfileRepository } from '@/infrastructure/mongo/repositories/profile';
const profile = await ProfileRepository.findByUserId(userId);
```
