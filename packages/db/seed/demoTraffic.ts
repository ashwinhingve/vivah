/**
 * demoTraffic.ts — Sprint J demo-traffic loader (Units 6.4/6.5).
 *
 * Loads packages/db/seed/data/demo-traffic-india.json (emitted by
 * build-demo-dataset.mjs — regenerate + commit, never hand-edit) into the
 * local/demo database: 150 vendors across the 10 registry cities, 50 users
 * engineered to populate every marketing segment, six months of back-dated
 * bookings/payments with wedding-season shape, capacity windows, and recent
 * match requests.
 *
 * PRODUCTION-REAL, DEV-ONLY DATA: every row goes through the same tables and
 * constraints real traffic uses — there are no code paths that know this data
 * is seeded. The loader itself is what must never touch prod, hence the guard.
 *
 * Idempotent: fixed UUIDs + onConflictDoNothing; run-twice is a no-op.
 *
 *   pnpm --filter @smartshaadi/db db:seed:demo
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';
import {
  user, profiles, notificationPreferences,
  vendors, vendorServices, vendorEventTypes, vendorCapacity,
  matchRequests, bookings, payments,
} from '../schema/index.js';

config({ path: resolve(__dirname, '../../../.env') });

// ── Prod guard — this loader must never run against a production database ────
export function assertNotProd(databaseUrl: string | undefined, nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error('demoTraffic seed refused: NODE_ENV=production');
  }
  if (!databaseUrl) {
    throw new Error('demoTraffic seed refused: DATABASE_URL is not set');
  }
  const host = databaseUrl.replace(/^[^@]*@/, '').toLowerCase();
  if (/rlwy\.net|railway|prod/.test(host)) {
    throw new Error(`demoTraffic seed refused: DATABASE_URL host looks like production (${host.split(':')[0]})`);
  }
}

interface DemoVendor {
  id: string; userId: string; profileId: string; businessName: string;
  category: string; city: string; state: string; verified: boolean;
  rating: string; totalReviews: number; yearsActive: number;
  priceMin: string; priceMax: string; phone: string; email: string;
  status: string; isActive: boolean; createdAt: string;
}
interface DemoService {
  id: string; vendorId: string; name: string; description: string;
  priceFrom: string; priceTo: string; isActive: boolean; createdAt: string;
}
interface DemoCapacity {
  id: string; profileId: string; startAt: string; endAt: string;
  status: string; maxBookings: number; bookedCount: number; offSeason: boolean;
}
interface DemoUser {
  id: string; profileId: string; name: string; email: string; phone: string;
  gender: string; city: string; state: string; band: string;
  profileCompleteness: number; marketingConsent: boolean;
  createdAt: string; lastActiveAt: string;
}
interface DemoMatchRequest {
  id: string; senderId: string; receiverId: string; status: string; createdAt: string;
}
interface DemoBooking {
  id: string; customerId: string; vendorId: string; eventDate: string;
  ceremonyType: string; status: string; totalAmount: string;
  guestCount: number; eventLocation: string; createdAt: string;
}
interface DemoPayment {
  id: string; bookingId: string; amount: string; currency: string;
  method: string; status: string; createdAt: string; settledAt: string | null;
}
interface DemoDataset {
  meta: { counts: Record<string, number> };
  vendors: DemoVendor[]; services: DemoService[]; capacities: DemoCapacity[];
  users: DemoUser[]; matchRequests: DemoMatchRequest[];
  bookings: DemoBooking[]; payments: DemoPayment[];
}

const CHUNK = 100;
function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

export async function seedDemoTraffic(): Promise<void> {
  assertNotProd(process.env['DATABASE_URL'], process.env['NODE_ENV']);

  const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
  const db = drizzle(pool);
  const data = JSON.parse(
    readFileSync(resolve(__dirname, 'data/demo-traffic-india.json'), 'utf8'),
  ) as DemoDataset;

  try {
    // 1. Better Auth user rows — vendors + individuals.
    const userRows = [
      ...data.vendors.map((v) => ({
        id: v.userId, name: v.businessName, email: v.email,
        phoneNumber: v.phone, role: 'VENDOR', createdAt: new Date(v.createdAt),
      })),
      ...data.users.map((u) => ({
        id: u.id, name: u.name, email: u.email,
        phoneNumber: u.phone, role: 'INDIVIDUAL', createdAt: new Date(u.createdAt),
      })),
    ];
    for (const batch of chunks(userRows)) {
      await db.insert(user).values(batch.map((u) => ({
        ...u,
        emailVerified: true,
        phoneNumberVerified: true,
        status: 'ACTIVE',
        updatedAt: new Date(u.createdAt),
      }))).onConflictDoNothing();
    }

    // 2. Profiles (vendor profiles carry the capacity FK; user profiles carry
    //    the activity signal the marketing segments read).
    const profileRows = [
      ...data.vendors.map((v) => ({
        id: v.profileId, userId: v.userId, completeness: 80,
        createdAt: new Date(v.createdAt), lastActiveAt: new Date(v.createdAt),
      })),
      ...data.users.map((u) => ({
        id: u.profileId, userId: u.id, completeness: u.profileCompleteness,
        createdAt: new Date(u.createdAt), lastActiveAt: new Date(u.lastActiveAt),
      })),
    ];
    for (const batch of chunks(profileRows)) {
      await db.insert(profiles).values(batch.map((p) => ({
        id: p.id, userId: p.userId,
        verificationStatus: 'VERIFIED' as const, premiumTier: 'FREE' as const,
        profileCompleteness: p.completeness, isActive: true,
        lastActiveAt: p.lastActiveAt, createdAt: p.createdAt, updatedAt: p.createdAt,
      }))).onConflictDoNothing();
    }

    // 3. Marketing consent — the 6.4 engine reads notification_preferences.
    //    ~80% of demo individuals opted in; the rest exercise the SUPPRESSED
    //    (NO_MARKETING_CONSENT) path, which is signal too.
    await db.insert(notificationPreferences).values(
      data.users.map((u) => ({ userId: u.id, marketing: u.marketingConsent })),
    ).onConflictDoNothing();

    // 4. Vendors + services + event types.
    for (const batch of chunks(data.vendors)) {
      await db.insert(vendors).values(batch.map((v) => ({
        id: v.id, userId: v.userId, businessName: v.businessName,
        category: v.category as typeof vendors.$inferInsert.category,
        city: v.city, state: v.state,
        verified: v.verified, rating: v.rating, totalReviews: v.totalReviews,
        yearsActive: v.yearsActive, priceMin: v.priceMin, priceMax: v.priceMax,
        phone: v.phone, email: v.email, isActive: v.isActive,
        status: v.status as typeof vendors.$inferInsert.status,
        createdAt: new Date(v.createdAt), updatedAt: new Date(v.createdAt),
      }))).onConflictDoNothing();
    }
    for (const batch of chunks(data.services)) {
      await db.insert(vendorServices).values(batch.map((s) => ({
        id: s.id, vendorId: s.vendorId, name: s.name, description: s.description,
        priceFrom: s.priceFrom, priceTo: s.priceTo, currency: 'INR',
        isActive: s.isActive, createdAt: new Date(s.createdAt),
      }))).onConflictDoNothing();
    }
    const eventTypeRows = data.vendors.flatMap((v) => (
      ['WEDDING', 'SANGEET', 'RECEPTION'].map((eventType) => ({
        vendorId: v.id,
        eventType: eventType as typeof vendorEventTypes.$inferInsert.eventType,
        available: true,
      }))
    ));
    for (const batch of chunks(eventTypeRows)) {
      await db.insert(vendorEventTypes).values(batch).onConflictDoNothing();
    }

    // 5. City registry backfill — same statement as migration 0038, so vendors
    //    inserted here get their city_id even though the JSON predates the ids.
    await db.execute(sql`
      UPDATE vendors v SET city_id = c.id
      FROM cities c
      WHERE v.city_id IS NULL AND v.city = c.name
    `);

    // 6. Capacity windows (utilization engine signal).
    for (const batch of chunks(data.capacities)) {
      await db.insert(vendorCapacity).values(batch.map((c) => ({
        id: c.id, profileId: c.profileId,
        startAt: new Date(c.startAt), endAt: new Date(c.endAt),
        status: c.status as typeof vendorCapacity.$inferInsert.status,
        maxBookings: c.maxBookings, bookedCount: c.bookedCount,
        offSeason: c.offSeason,
      }))).onConflictDoNothing();
    }

    // 7. Match requests (high-intent segment signal, last 7 days).
    for (const batch of chunks(data.matchRequests)) {
      await db.insert(matchRequests).values(batch.map((m) => ({
        id: m.id, senderId: m.senderId, receiverId: m.receiverId,
        status: m.status as typeof matchRequests.$inferInsert.status,
        createdAt: new Date(m.createdAt), updatedAt: new Date(m.createdAt),
      }))).onConflictDoNothing();
    }

    // 8. Bookings + payments (forecast seasonality + per-city revenue).
    for (const batch of chunks(data.bookings)) {
      await db.insert(bookings).values(batch.map((b) => ({
        id: b.id, customerId: b.customerId, vendorId: b.vendorId,
        eventDate: b.eventDate,
        ceremonyType: b.ceremonyType as typeof bookings.$inferInsert.ceremonyType,
        status: b.status as typeof bookings.$inferInsert.status,
        totalAmount: b.totalAmount, guestCount: b.guestCount,
        eventLocation: b.eventLocation,
        createdAt: new Date(b.createdAt), updatedAt: new Date(b.createdAt),
      }))).onConflictDoNothing();
    }
    for (const batch of chunks(data.payments)) {
      await db.insert(payments).values(batch.map((p) => ({
        id: p.id, bookingId: p.bookingId, amount: p.amount, currency: p.currency,
        method: p.method as typeof payments.$inferInsert.method,
        status: p.status as typeof payments.$inferInsert.status,
        createdAt: new Date(p.createdAt),
        settledAt: p.settledAt ? new Date(p.settledAt) : null,
      }))).onConflictDoNothing();
    }

    const counts = data.meta.counts;
    console.info(
      `✅ Demo traffic seeded: ${counts['vendors']} vendors, ${counts['users']} users, ` +
      `${counts['bookings']} bookings, ${counts['payments']} payments, ` +
      `${counts['capacities']} capacity windows, ${counts['matchRequests']} match requests`,
    );
  } finally {
    await pool.end();
  }
}

// Direct execution: pnpm --filter @smartshaadi/db db:seed:demo
if (require.main === module) {
  seedDemoTraffic()
    .then(() => process.exit(0))
    .catch((e: unknown) => { console.error('❌ Demo seed failed:', e); process.exit(1); });
}
