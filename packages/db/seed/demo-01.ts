/**
 * DEMO ENRICHMENT SEED — the six canonical "-01" QA accounts (client walkthrough)
 * ==============================================================================
 * test-accounts.ts creates the 44 qa-% shells. This script fills the RELATIONAL
 * + rich layers that make each of the six role "-01" accounts look alive for a
 * live client demo, woven into ONE story: Aditya (qa-ind-01) & Priya (qa-ind-04)
 * matched → wedding at Royal Garden Banquets (qa-ven-01) → coordinated by Anil
 * (qa-coord-01) → watched by family Lakshmi (qa-fam-01) → admin (qa-admin-01)
 * has a KYC + vendor queue → support (qa-support-01) resolves tickets.
 *
 * Stores touched:
 *   Postgres  match_requests, match_scores, profile_views, notifications,
 *             notification_preferences, bookings, wedding_vendor_assignments,
 *             vendor_reviews, wedding_tasks, guests, family_match_ratings,
 *             support_tickets, ticket_messages, ticket_events
 *             + 3 scoped UPDATEs (weddings partner→Priya, one vendor→UNDER_REVIEW,
 *               one profile→MANUAL_REVIEW) to populate the admin queues.
 *   Mongo     profiles_content (Aditya+Priya, enriched), chats (their thread),
 *             vendor_portfolios (Royal Garden), weddingplans (the wedding).
 *
 * IDEMPOTENT: new rows use deterministic 0ade-namespace UUIDs + onConflictDoNothing/
 * onConflictDoUpdate; match_requests upsert by (sender,receiver); Mongo upserts by
 * natural key. Safe to re-run. Teardown: `--remove` (deletes 0ade rows + demo Mongo).
 *
 * Run (target = whatever DATABASE_URL / MONGODB_URI point at — pass PRODUCTION_DB /
 * PRODUCTION_MONGO to hit prod). Root .env is loaded for any unset vars:
 *   DATABASE_URL=$PRODUCTION_DB MONGODB_URI=$PRODUCTION_MONGO \
 *     pnpm --filter @smartshaadi/db tsx seed/demo-01.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose, { Schema } from 'mongoose';
import {
  weddings, matchRequests, matchScores, notifications, notificationPreferences,
  bookings, vendorReviews, weddingTasks, guests, guestLists, profileViews, familyMatchRatings,
  weddingVendorAssignments, supportTickets, ticketMessages, ticketEvents, profiles, vendors,
} from '../schema/index.js';

config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);
const REMOVE = process.argv.includes('--remove');

// ── Fixed ids (from prod introspection) ───────────────────────────────────────
const ADI   = '0ada0001-0000-4000-8000-000000000001'; // qa-ind-01 profile (Aditya)
const PRIYA = '0ada0001-0000-4000-8000-000000000004'; // qa-ind-04 profile (Priya)
const C6    = '0ada0001-0000-4000-8000-000000000006'; // qa-ind-06 (Simran)
const C8    = '0ada0001-0000-4000-8000-000000000008'; // qa-ind-08 (Divya)
const C10   = '0ada0001-0000-4000-8000-000000000010'; // qa-ind-10 (Ayesha)
const VEN   = '0ada0006-0000-4000-8000-000000000001'; // qa-ven-01 vendor row (Royal Garden)
const SVC   = '0ada0005-0000-4000-8000-000000000001'; // qa-ven-01 service (Full-day banquet hire)
const WED   = '0ada0009-0000-4000-8000-000000000001'; // QA wedding (guest_list resolved at runtime)

const U_ADI = 'qa-ind-01', U_PRIYA = 'qa-ind-04', U_VEN = 'qa-ven-01';
const U_FAM = 'qa-fam-01', U_COORD = 'qa-coord-01', U_ADMIN = 'qa-admin-01', U_SUPPORT = 'qa-support-01';
const U_C6 = 'qa-ind-06', U_C8 = 'qa-ind-08', U_C10 = 'qa-ind-10';
const U_VEN9 = 'qa-ven-09';   // pushed to UNDER_REVIEW for the admin vendor queue
const U_IND21 = 'qa-ind-21';  // pushed to MANUAL_REVIEW for the admin KYC queue

// Deterministic UUID factory — one 0ade byte-prefix per table, all distinct from 0ada.
const pad = (n: number): string => n.toString().padStart(12, '0');
const uid = (prefix: string, n: number): string => `0ade${prefix}-0000-4000-8000-${pad(n)}`;

const d = (s: string): Date => new Date(`${s}T09:00:00.000Z`);
const days = (n: number): Date => new Date(Date.now() + n * 86_400_000);

// ── PROFILE_VIEWS ─────────────────────────────────────────────────────────────
async function seedProfileViews(): Promise<void> {
  const rows = [
    { id: uid('000b', 1), viewerProfileId: C6,  viewedProfileId: ADI },
    { id: uid('000b', 2), viewerProfileId: C8,  viewedProfileId: ADI },
    { id: uid('000b', 3), viewerProfileId: C10, viewedProfileId: ADI },
    { id: uid('000b', 4), viewerProfileId: ADI, viewedProfileId: PRIYA },
    { id: uid('000b', 5), viewerProfileId: ADI, viewedProfileId: C10 },
    { id: uid('000b', 6), viewerProfileId: PRIYA, viewedProfileId: ADI },
  ];
  for (const r of rows) await db.insert(profileViews).values(r).onConflictDoNothing();
  console.info(`  ✅ ${rows.length} profile views`);
}

// ── MATCH_REQUESTS ────────────────────────────────────────────────────────────
async function seedMatchRequests(): Promise<void> {
  // Aditya ↔ Priya already ACCEPTED in prod — enrich it (acceptance msg / seen).
  await db.insert(matchRequests).values({
    senderId: ADI, receiverId: PRIYA, status: 'ACCEPTED', priority: 'SUPER_LIKE',
    message: 'Hi Priya — loved your profile. Would be great to connect!',
    acceptanceMessage: "Hi Aditya, thank you — I'd like to talk too 😊",
    seenAt: days(-8), respondedAt: days(-7), expiresAt: days(6),
  }).onConflictDoUpdate({
    target: [matchRequests.senderId, matchRequests.receiverId],
    set: {
      status: 'ACCEPTED', priority: 'SUPER_LIKE',
      acceptanceMessage: "Hi Aditya, thank you — I'd like to talk too 😊",
      seenAt: days(-8), respondedAt: days(-7), updatedAt: days(-7),
    },
  });
  // Incoming pending (Simran → Aditya, Divya → Aditya)
  const incoming = [
    { senderId: C6, receiverId: ADI, message: 'Hi Aditya, we seem to share a lot — hope to hear back!' },
    { senderId: C8, receiverId: ADI, message: 'Hello! Your profile stood out to me. Would love to connect.' },
  ];
  for (const m of incoming) {
    await db.insert(matchRequests).values({
      senderId: m.senderId, receiverId: m.receiverId, status: 'PENDING', priority: 'NORMAL',
      message: m.message, expiresAt: days(12),
    }).onConflictDoUpdate({
      target: [matchRequests.senderId, matchRequests.receiverId],
      set: { status: 'PENDING', message: m.message, updatedAt: new Date() },
    });
  }
  // Outgoing pending (Aditya → Ayesha) — awaiting her response
  await db.insert(matchRequests).values({
    senderId: ADI, receiverId: C10, status: 'PENDING', priority: 'NORMAL',
    message: 'Hi Ayesha — would love to know you better.', seenAt: days(-1), expiresAt: days(13),
  }).onConflictDoUpdate({
    target: [matchRequests.senderId, matchRequests.receiverId],
    set: { status: 'PENDING', seenAt: days(-1), updatedAt: new Date() },
  });
  console.info('  ✅ match requests: 1 accepted (Aditya↔Priya) + 2 incoming + 1 outgoing');
}

// ── MATCH_SCORES ──────────────────────────────────────────────────────────────
function breakdown(guna: number, recip: Record<string, number>): Record<string, unknown> {
  return {
    guna: { varna: 1, vashya: 2, tara: 3, yoni: 4, grahaMaitri: 5, gana: 6, bhakoot: 7, nadi: 8, total: guna },
    reciprocal: recip,
  };
}
async function seedMatchScores(): Promise<void> {
  const rows = [
    { id: uid('0001', 1), profileA: ADI, profileB: PRIYA, totalScore: 91, gunaMilanScore: 32,
      breakdown: breakdown(32, { ageMatch: 95, locationMatch: 90, communityMatch: 100, careerMatch: 88, lifestyleMatch: 85 }),
      familyJointScore: 92, familySignalCount: 1, familyAgreementPct: 100 },
    { id: uid('0001', 2), profileA: ADI, profileB: C6, totalScore: 78, gunaMilanScore: 26,
      breakdown: breakdown(26, { ageMatch: 88, locationMatch: 70, communityMatch: 60, careerMatch: 82, lifestyleMatch: 80 }) },
    { id: uid('0001', 3), profileA: ADI, profileB: C8, totalScore: 74, gunaMilanScore: 24,
      breakdown: breakdown(24, { ageMatch: 85, locationMatch: 65, communityMatch: 55, careerMatch: 90, lifestyleMatch: 78 }) },
    { id: uid('0001', 4), profileA: ADI, profileB: C10, totalScore: 81, gunaMilanScore: 28,
      breakdown: breakdown(28, { ageMatch: 90, locationMatch: 75, communityMatch: 70, careerMatch: 85, lifestyleMatch: 82 }) },
  ];
  for (const r of rows) {
    await db.insert(matchScores).values(r).onConflictDoUpdate({
      target: [matchScores.profileA, matchScores.profileB],
      set: { totalScore: r.totalScore, gunaMilanScore: r.gunaMilanScore, breakdown: r.breakdown, updatedAt: new Date() },
    });
  }
  console.info(`  ✅ ${rows.length} match scores (Aditya↔Priya = 91%)`);
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
type Notif = { userId: string; type: string; title: string; body: string; read?: boolean; data?: Record<string, unknown> };
async function seedNotifications(): Promise<void> {
  const N: Notif[] = [
    // Aditya
    { userId: U_ADI, type: 'MATCH_ACCEPTED', title: 'Priya accepted your request 🎉', body: 'You and Priya are now connected. Say hello!', data: { ctaUrl: '/matches' } },
    { userId: U_ADI, type: 'NEW_MESSAGE', title: 'New message from Priya', body: 'Priya: Looking forward to our families meeting!', data: { ctaUrl: '/chat' } },
    { userId: U_ADI, type: 'NEW_MATCH', title: 'Simran sent you a request', body: 'A new interest is waiting for your response.', data: { ctaUrl: '/requests' } },
    { userId: U_ADI, type: 'NEW_MATCH', title: 'Divya sent you a request', body: 'A new interest is waiting for your response.', read: true, data: { ctaUrl: '/requests' } },
    // Priya
    { userId: U_PRIYA, type: 'NEW_MATCH', title: 'Aditya sent you a Super Like', body: 'Aditya is very interested in connecting with you.', read: true, data: { ctaUrl: '/requests' } },
    { userId: U_PRIYA, type: 'NEW_MESSAGE', title: 'New message from Aditya', body: 'Aditya: Shall we plan a call this weekend?', data: { ctaUrl: '/chat' } },
    // Vendor (Royal Garden)
    { userId: U_VEN, type: 'NEW_BOOKING_REQUEST', title: 'New enquiry for 15 Nov', body: 'A couple enquired about your full-day banquet package.', data: { ctaUrl: '/vendor/bookings' } },
    { userId: U_VEN, type: 'BOOKING_CONFIRMED', title: 'Booking confirmed — 31 Oct', body: 'Aditya & Priya confirmed Royal Garden Banquets for their wedding.', read: true, data: { ctaUrl: '/vendor/bookings' } },
    { userId: U_VEN, type: 'PAYMENT_RECEIVED', title: 'Advance received ₹1,00,000', body: 'Escrow is holding the advance for the 31 Oct booking.', data: { ctaUrl: '/vendor/payments' } },
    // Family (Lakshmi)
    { userId: U_FAM, type: 'SYSTEM', title: 'Aditya has a new match to review', body: 'Aditya connected with Priya (91% compatible). Add your rating.', data: { ctaUrl: '/family/matches' } },
    // Coordinator (Anil)
    { userId: U_COORD, type: 'COORDINATOR_ASSIGNED', title: "You're coordinating Aditya & Priya's wedding", body: 'Full access granted. 31 Oct 2026 at Royal Garden Banquets.', read: true, data: { ctaUrl: '/coordinator' } },
    { userId: U_COORD, type: 'TASK_DUE', title: 'Task due: finalise catering menu', body: 'Due in 3 days for the Sangeet.', data: { ctaUrl: '/coordinator/tasks' } },
    { userId: U_COORD, type: 'CEREMONY_REMINDER', title: 'Haldi in 30 days', body: 'The Haldi ceremony is scheduled for 29 Oct 2026.', data: { ctaUrl: '/coordinator' } },
    // Admin
    { userId: U_ADMIN, type: 'SYSTEM', title: 'KYC review pending', body: '1 profile is awaiting manual KYC review.', data: { ctaUrl: '/admin/kyc' } },
    { userId: U_ADMIN, type: 'SYSTEM', title: 'Vendor approval pending', body: 'Vedic Rituals Pandit Ji is under review.', data: { ctaUrl: '/admin/vendors' } },
    { userId: U_ADMIN, type: 'DISPUTE_NEEDS_REVIEW', title: 'A support ticket was escalated', body: 'A payment dispute needs admin attention.', data: { ctaUrl: '/admin/disputes' } },
    // Support
    { userId: U_SUPPORT, type: 'SYSTEM', title: '3 tickets assigned to you', body: '1 open, 1 in progress, 1 resolved.', data: { ctaUrl: '/support' } },
    { userId: U_SUPPORT, type: 'DISPUTE_NEEDS_REVIEW', title: 'New payment ticket', body: 'Royal Garden Banquets raised a payout query.', data: { ctaUrl: '/support' } },
  ];
  let i = 0;
  for (const n of N) {
    i += 1;
    await db.insert(notifications).values({
      id: uid('0002', i), userId: n.userId, type: n.type as never,
      title: n.title, body: n.body, data: n.data ?? {}, read: n.read ?? false, sentVia: ['IN_APP'],
    }).onConflictDoNothing();
  }
  // Sensible notification preferences (unmuted) for everyone we touch.
  for (const u of [U_ADI, U_PRIYA, U_VEN, U_FAM, U_COORD, U_ADMIN, U_SUPPORT]) {
    await db.insert(notificationPreferences).values({ userId: u }).onConflictDoNothing();
  }
  console.info(`  ✅ ${N.length} notifications across all 6 roles`);
}

// ── BOOKINGS + VENDOR ASSIGNMENT + REVIEW ─────────────────────────────────────
async function seedVendorFlow(): Promise<void> {
  const confirmedId = uid('0003', 1);
  const pendingId = uid('0003', 2);
  // Confirmed booking for the wedding (31 Oct)
  await db.insert(bookings).values({
    id: confirmedId, customerId: U_ADI, vendorId: VEN, serviceId: SVC, weddingId: WED,
    eventDate: '2026-10-31', ceremonyType: 'WEDDING', status: 'CONFIRMED',
    totalAmount: '250000.00', packageName: 'Grand Wedding Package', packagePrice: '250000.00',
    guestCount: 350, eventLocation: 'Royal Garden Banquets, Jaipur',
    notes: 'Full-day hire incl. valet, décor slots and green rooms.',
  }).onConflictDoNothing();
  // Pending enquiry from another couple (different date → respects vendor/date partial-unique)
  await db.insert(bookings).values({
    id: pendingId, customerId: U_C6, vendorId: VEN, serviceId: SVC,
    eventDate: '2026-11-15', ceremonyType: 'RECEPTION', status: 'PENDING',
    totalAmount: '180000.00', packageName: 'Reception Hall Package', packagePrice: '180000.00',
    guestCount: 220, eventLocation: 'Royal Garden Banquets, Jaipur', notes: 'Awaiting availability confirmation.',
  }).onConflictDoNothing();
  // Link the confirmed booking to the wedding as the VENUE vendor
  await db.insert(weddingVendorAssignments).values({
    id: uid('000c', 1), weddingId: WED, vendorId: VEN, bookingId: confirmedId,
    role: 'VENUE', status: 'CONFIRMED', notes: 'Venue locked for 31 Oct.',
  }).onConflictDoNothing();
  // A glowing review on the confirmed booking
  await db.insert(vendorReviews).values({
    id: uid('0006', 1), vendorId: VEN, bookingId: confirmedId, reviewerId: U_ADI, rating: 5,
    title: 'Stunning venue, flawless service', comment: 'Royal Garden made our wedding magical — spotless lawns, superb staff, great value.',
    vendorReply: 'Thank you Aditya & Priya! It was an honour to host you.', vendorRepliedAt: days(-2),
  }).onConflictDoNothing();
  console.info('  ✅ 2 bookings (1 confirmed + 1 pending), 1 vendor assignment, 1 review');
}

// ── WEDDING TASKS + GUESTS ────────────────────────────────────────────────────
async function resolveGuestList(): Promise<string> {
  const [gl] = await db.select({ id: guestLists.id }).from(guestLists).where(eq(guestLists.weddingId, WED));
  if (gl) return gl.id;
  const id = uid('000e', 1);
  await db.insert(guestLists).values({ id, weddingId: WED, createdBy: U_ADI }).onConflictDoNothing();
  const [again] = await db.select({ id: guestLists.id }).from(guestLists).where(eq(guestLists.weddingId, WED));
  return again?.id ?? id;
}

async function seedWeddingBoard(): Promise<void> {
  const glist = await resolveGuestList();
  const tasks = [
    { n: 1, title: 'Book venue', status: 'DONE', priority: 'HIGH', category: 'Venue', due: '2026-08-01' },
    { n: 2, title: 'Finalise catering menu', status: 'IN_PROGRESS', priority: 'HIGH', category: 'Catering', due: '2026-10-01' },
    { n: 3, title: 'Send invitations', status: 'IN_PROGRESS', priority: 'MEDIUM', category: 'Guests', due: '2026-09-15' },
    { n: 4, title: 'Confirm photographer', status: 'TODO', priority: 'MEDIUM', category: 'Photography', due: '2026-09-20' },
    { n: 5, title: 'Arrange mehndi artist', status: 'TODO', priority: 'LOW', category: 'Beauty', due: '2026-10-10' },
    { n: 6, title: 'Day-of transport plan', status: 'TODO', priority: 'MEDIUM', category: 'Logistics', due: '2026-10-25' },
  ];
  for (const t of tasks) {
    await db.insert(weddingTasks).values({
      id: uid('0004', t.n), weddingId: WED, title: t.title, status: t.status, priority: t.priority,
      category: t.category, dueDate: t.due, assignedTo: U_COORD,
      completedAt: t.status === 'DONE' ? days(-20) : null,
    }).onConflictDoNothing();
  }
  const gs = [
    { n: 1, name: 'Ramrao Deshmukh', rel: 'Father of Groom', side: 'GROOM', rsvp: 'YES', vip: true },
    { n: 2, name: 'Lakshmi Deshmukh', rel: 'Mother of Groom', side: 'GROOM', rsvp: 'YES', vip: true },
    { n: 3, name: 'Suresh Patil', rel: 'Father of Bride', side: 'BRIDE', rsvp: 'YES', vip: true },
    { n: 4, name: 'Kavita Patil', rel: 'Mother of Bride', side: 'BRIDE', rsvp: 'YES', vip: true },
    { n: 5, name: 'Rohan Joshi', rel: 'Friend', side: 'GROOM', rsvp: 'YES', vip: false },
    { n: 6, name: 'Sneha Kulkarni', rel: 'Cousin', side: 'BRIDE', rsvp: 'MAYBE', vip: false },
    { n: 7, name: 'Vikram Reddy', rel: 'Colleague', side: 'GROOM', rsvp: 'NO', vip: false },
    { n: 8, name: 'Ananya Nair', rel: 'Friend', side: 'BRIDE', rsvp: 'PENDING', vip: false },
  ];
  for (const g of gs) {
    await db.insert(guests).values({
      id: uid('0005', g.n), guestListId: glist, name: g.name, relationship: g.rel,
      side: g.side, rsvpStatus: g.rsvp as never, isVip: g.vip, plusOnes: g.vip ? 1 : 0,
    }).onConflictDoNothing();
  }
  console.info(`  ✅ ${tasks.length} wedding tasks + ${gs.length} guests`);
}

// ── FAMILY RATING ─────────────────────────────────────────────────────────────
async function seedFamily(): Promise<void> {
  await db.insert(familyMatchRatings).values({
    id: uid('0007', 1), raterUserId: U_FAM, subjectProfileId: ADI, candidateProfileId: PRIYA,
    overallScore: 9, compatibilityConcerns: [], notes: 'Wonderful family, well-matched values. We approve wholeheartedly.',
  }).onConflictDoNothing();
  console.info('  ✅ family rating (Lakshmi → Priya = 9/10)');
}

// ── SUPPORT TICKETS ───────────────────────────────────────────────────────────
async function seedSupport(): Promise<void> {
  const tickets = [
    { n: 1, subject: 'Cannot upload profile photo', category: 'TECHNICAL', priority: 'NORMAL', status: 'OPEN', source: 'USER', by: U_ADI, resolvedBy: null },
    { n: 2, subject: 'Payout not received for October booking', category: 'PAYMENT', priority: 'HIGH', status: 'PENDING', source: 'USER', by: U_VEN, resolvedBy: null },
    { n: 3, subject: 'How do I export my guest list?', category: 'ACCOUNT', priority: 'LOW', status: 'RESOLVED', source: 'USER', by: U_PRIYA, resolvedBy: U_SUPPORT },
  ];
  for (const t of tickets) {
    const tid = uid('0008', t.n);
    await db.insert(supportTickets).values({
      id: tid, subject: t.subject, description: `${t.subject}. Raised via the app.`,
      category: t.category as never, priority: t.priority as never, status: t.status as never,
      source: t.source as never, raisedByUserId: t.by, assignedToUserId: U_SUPPORT,
      firstRespondedAt: t.status === 'OPEN' ? null : days(-1),
      resolvedAt: t.status === 'RESOLVED' ? days(-1) : null, resolvedByUserId: t.resolvedBy,
      slaDueAt: days(1),
    }).onConflictDoNothing();
    await db.insert(ticketMessages).values({
      id: uid('0009', t.n * 2 - 1), ticketId: tid, authorUserId: t.by, body: `${t.subject} — please help.`, isInternalNote: false,
    }).onConflictDoNothing();
    if (t.status !== 'OPEN') {
      await db.insert(ticketMessages).values({
        id: uid('0009', t.n * 2), ticketId: tid, authorUserId: U_SUPPORT,
        body: t.status === 'RESOLVED' ? 'Sorted — you can export from Guests → ⋯ → Export CSV. Closing this now.' : "We're looking into your payout and will update you shortly.",
        isInternalNote: false,
      }).onConflictDoNothing();
    }
    await db.insert(ticketEvents).values({
      id: uid('000a', t.n * 2 - 1), ticketId: tid, actorUserId: t.by, eventType: 'CREATED', meta: {},
    }).onConflictDoNothing();
    await db.insert(ticketEvents).values({
      id: uid('000a', t.n * 2), ticketId: tid, actorUserId: U_SUPPORT,
      eventType: t.status === 'RESOLVED' ? 'RESOLVED' : 'ASSIGNED', meta: {},
    }).onConflictDoNothing();
  }
  console.info(`  ✅ ${tickets.length} support tickets (open / in-progress / resolved) + messages + events`);
}

// ── SCOPED UPDATES: realign wedding to Priya + fill admin queues ───────────────
async function seedUpdates(): Promise<void> {
  await db.update(weddings).set({
    partnerProfileId: PRIYA, brideName: 'Priya Patil', groomName: 'Aditya Deshmukh',
    title: 'Aditya & Priya', venueName: 'Royal Garden Banquets', venueCity: 'Jaipur',
    budgetTotal: '1500000.00', guestCount: 350, hashtag: '#AdityaWedsPriya', primaryColor: '#7B2D42',
    weddingDate: '2026-10-31', updatedAt: new Date(),
  }).where(eq(weddings.id, WED));
  // Admin KYC queue — park qa-ind-21 in manual review
  await db.update(profiles).set({ verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date() })
    .where(eq(profiles.userId, U_IND21));
  // Admin vendor queue — put one vendor under review
  await db.update(vendors).set({ status: 'UNDER_REVIEW', submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(vendors.userId, U_VEN9));
  console.info('  ✅ wedding realigned to Aditya & Priya; admin KYC + vendor queues populated');
}

// ── MONGO ─────────────────────────────────────────────────────────────────────
const profileContentSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  personal: Schema.Types.Mixed, education: Schema.Types.Mixed, profession: Schema.Types.Mixed,
  family: Schema.Types.Mixed, location: Schema.Types.Mixed, lifestyle: Schema.Types.Mixed,
  horoscope: Schema.Types.Mixed, partnerPreferences: Schema.Types.Mixed, personality: Schema.Types.Mixed,
  safetyMode: Schema.Types.Mixed, aboutMe: String, partnerDescription: String,
}, { collection: 'profiles_content', timestamps: true });
const chatSchema = new Schema({
  participants: [String], matchRequestId: { type: String, unique: true }, messages: Schema.Types.Mixed,
  lastMessage: Schema.Types.Mixed, settings: Schema.Types.Mixed, isActive: Boolean,
}, { collection: 'chats', timestamps: true });
const portfolioSchema = new Schema({
  vendorId: { type: String, required: true, unique: true }, about: String, tagline: String,
  portfolio: Schema.Types.Mixed, packages: Schema.Types.Mixed, eventTypes: [String],
  faqs: Schema.Types.Mixed, awards: [String], certifications: [String],
}, { collection: 'vendor_portfolios', timestamps: true });
const weddingPlanSchema = new Schema({
  weddingId: { type: String, required: true, unique: true }, theme: Schema.Types.Mixed,
  budget: Schema.Types.Mixed, ceremonies: Schema.Types.Mixed, checklist: Schema.Types.Mixed,
  muhuratDates: Schema.Types.Mixed,
}, { collection: 'weddingplans', timestamps: true });

const M = <T>(name: string, s: Schema): mongoose.Model<T> =>
  (mongoose.models[name] as mongoose.Model<T> | undefined) ?? mongoose.model<T>(name, s);
const ProfileContent = M<Record<string, unknown>>('DemoProfileContent', profileContentSchema);
const ChatModel = M<Record<string, unknown>>('DemoChat', chatSchema);
const Portfolio = M<Record<string, unknown>>('DemoPortfolio', portfolioSchema);
const WeddingPlan = M<Record<string, unknown>>('DemoWeddingPlan', weddingPlanSchema);

function heroContent(userId: string, who: 'ADI' | 'PRIYA'): Record<string, unknown> {
  const isAdi = who === 'ADI';
  return {
    userId,
    personal: {
      fullName: isAdi ? 'Aditya Deshmukh' : 'Priya Patil',
      dob: new Date(isAdi ? '1997-06-15' : '1998-03-22'), gender: isAdi ? 'MALE' : 'FEMALE',
      height: isAdi ? 178 : 162, complexion: 'WHEATISH', maritalStatus: 'NEVER_MARRIED',
      motherTongue: 'Marathi', religion: 'Hindu', caste: 'Maratha',
      subCaste: isAdi ? '96 Kuli Maratha' : 'Maratha', manglik: !isAdi, gotra: isAdi ? 'Shendge' : 'Jadhav',
    },
    profession: {
      occupation: isAdi ? 'Software Engineer' : 'Chartered Accountant',
      employer: isAdi ? 'Persistent Systems' : 'Deloitte', incomeRange: '15-25 LPA',
      workLocation: isAdi ? 'Pune, Maharashtra' : 'Mumbai, Maharashtra', employerType: 'PRIVATE',
      designation: isAdi ? 'Senior Software Engineer' : 'Manager, Audit & Assurance',
    },
    education: { degree: isAdi ? 'B.E. Computer Science' : 'B.Com + CA', college: isAdi ? 'COEP Pune' : 'Sydenham, Mumbai', year: isAdi ? 2019 : 2020 },
    location: { city: isAdi ? 'Pune' : 'Mumbai', state: 'Maharashtra', country: 'India' },
    lifestyle: {
      diet: 'NON_VEG', smoking: 'NEVER', drinking: 'OCCASIONALLY',
      hobbies: isAdi ? ['Trekking', 'Cricket', 'Coding'] : ['Classical dance', 'Baking', 'Reading'],
      interests: ['Travel', 'Food', 'Cinema'], languagesSpoken: ['Marathi', 'Hindi', 'English'], fitnessLevel: 'ACTIVE',
    },
    family: {
      fatherName: isAdi ? 'Ramrao Deshmukh' : 'Suresh Patil', fatherOccupation: 'Business',
      motherName: isAdi ? 'Lakshmi Deshmukh' : 'Kavita Patil', motherOccupation: 'Homemaker',
      siblings: [{ relation: isAdi ? 'Sister' : 'Brother', maritalStatus: 'MARRIED' }],
      familyType: 'NUCLEAR', familyValues: 'TRADITIONAL_MODERATE', familyStatus: 'UPPER_MIDDLE',
      nativePlace: isAdi ? 'Pune, Maharashtra' : 'Kolhapur, Maharashtra',
    },
    horoscope: { rashi: isAdi ? 'Tula' : 'Mesha', nakshatra: isAdi ? 'Chitra' : 'Ashwini',
      dob: new Date(isAdi ? '1997-06-15' : '1998-03-22'), tob: '06:00', pob: isAdi ? 'Pune' : 'Kolhapur', manglik: !isAdi, gunaScore: 32 },
    personality: { openness: 6, conscientiousness: 6, extraversion: isAdi ? 4 : 5, agreeableness: 6, emotionalStability: 6, ambition: 6, familyOrientation: 7 },
    partnerPreferences: {
      ageRange: { min: 25, max: 33 }, heightRange: { min: 150, max: 190 },
      education: ['Bachelors', 'Masters', 'CA', 'B.Tech'], religion: ['Hindu'], manglik: 'ANY',
      diet: ['VEG', 'NON_VEG', 'EGGETARIAN'], incomeMin: 800000, locations: ['Maharashtra', 'India'],
      openToInterCaste: true, openToInterfaith: false, maritalStatus: ['NEVER_MARRIED'],
      partnerGender: [isAdi ? 'FEMALE' : 'MALE'],
    },
    aboutMe: isAdi
      ? 'Pune-based software engineer who loves the outdoors and a good cup of chai. Family-oriented, easy-going, looking for a partner to build a warm, equal home with.'
      : 'Mumbai-based Chartered Accountant. Trained Bharatanatyam dancer, weekend baker. Value honesty, ambition and a good sense of humour. Looking for a caring, driven partner.',
    partnerDescription: isAdi
      ? 'Someone independent, kind and family-minded — a true teammate for life.'
      : 'A grounded, ambitious and warm person who values family as much as career.',
    safetyMode: { contactHidden: true, unlockedWith: [PRIYA === userId ? ADI : PRIYA] },
  };
}

function chatDoc(matchRequestId: string): Record<string, unknown> {
  const mk = (senderId: string, content: string, contentHi: string, offsetMin: number): Record<string, unknown> => ({
    senderId, content, contentEn: content, contentHi, type: 'TEXT',
    sentAt: new Date(Date.now() - offsetMin * 60_000), readBy: [ADI, PRIYA], deliveredTo: [ADI, PRIYA],
  });
  const messages = [
    mk(ADI, 'Hi Priya! Really glad we connected 😊', 'नमस्ते प्रिया! खूप आनंद झाला की आपण जोडलो 😊', 600),
    mk(PRIYA, 'Hi Aditya! Same here. Loved that you trek — I keep meaning to start!', 'नमस्कार आदित्य! मलाही आवडलं. तुम्ही ट्रेकिंग करता हे छान!', 585),
    mk(ADI, 'Haha we should do an easy one near Pune sometime.', 'हाहा, पुण्याजवळ एखादा सोपा ट्रेक करूया.', 560),
    mk(PRIYA, "I'd like that. So — Persistent, right? How long have you been there?", 'नक्की. मग तुम्ही Persistent मध्ये किती वर्षं आहात?', 540),
    mk(ADI, 'Four years now. You? Deloitte audit must keep you busy this season 📊', 'चार वर्षं झाली. तुम्ही? ऑडिट सीझनमध्ये खूप काम असेल ना 📊', 520),
    mk(PRIYA, 'Very! But I love it. Family is keen to meet — maybe our parents can talk?', 'खूप! पण मला आवडतं. घरचे भेटायला उत्सुक आहेत — पालक बोलू शकतील का?', 400),
    mk(ADI, 'Absolutely. My mother (Lakshmi) is already excited 😄', 'नक्कीच. माझी आई (लक्ष्मी) आधीच खूश आहे 😄', 380),
    mk(PRIYA, 'So sweet! Shall we plan a call this weekend?', 'किती छान! या weekend ला कॉल करूया का?', 200),
    mk(ADI, 'Shall we plan a call this weekend? Sunday evening works for me.', 'रविवारी संध्याकाळ मला चालेल.', 180),
    mk(PRIYA, 'Sunday it is. Looking forward to our families meeting!', 'रविवारी नक्की. आपली कुटुंबं भेटायला उत्सुक आहे!', 60),
  ];
  const last = messages[messages.length - 1] as Record<string, unknown>;
  return {
    participants: [ADI, PRIYA], matchRequestId, messages, isActive: true,
    settings: { mutedBy: [], archivedBy: [], pinnedBy: [] },
    lastMessage: { content: last['content'], sentAt: last['sentAt'], senderId: last['senderId'], type: 'TEXT' },
  };
}

async function seedMongo(matchRequestId: string): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) { console.warn('  ⚠️  MONGODB_URI not set — skipping Mongo (chat / portfolio / plan / content)'); return; }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  await ProfileContent.findOneAndUpdate({ userId: U_ADI }, heroContent(U_ADI, 'ADI'), { upsert: true });
  await ProfileContent.findOneAndUpdate({ userId: U_PRIYA }, heroContent(U_PRIYA, 'PRIYA'), { upsert: true });
  await ChatModel.findOneAndUpdate({ matchRequestId }, chatDoc(matchRequestId), { upsert: true });
  await Portfolio.findOneAndUpdate({ vendorId: VEN }, {
    vendorId: VEN, tagline: 'Jaipur’s most-loved garden wedding venue',
    about: 'Set across 3 acres of manicured lawns, Royal Garden Banquets hosts fairy-tale weddings for 100–800 guests, with in-house décor, valet and catering partners.',
    portfolio: [
      { title: 'Sharma–Verma Wedding', description: 'Sunset lawn wedding for 400', eventType: 'WEDDING', photoKeys: ['qa/portfolio/rg-1.jpg', 'qa/portfolio/rg-2.jpg'] },
      { title: 'Corporate Gala', description: 'Awards night for 250', eventType: 'CORPORATE', photoKeys: ['qa/portfolio/rg-3.jpg'] },
      { title: 'Mehndi Afternoon', description: 'Intimate poolside mehndi', eventType: 'MEHNDI', photoKeys: ['qa/portfolio/rg-4.jpg'] },
      { title: 'Grand Reception', description: 'Ballroom reception for 600', eventType: 'RECEPTION', photoKeys: ['qa/portfolio/rg-5.jpg'] },
    ],
    packages: [
      { name: 'Grand Wedding Package', price: 250000, priceUnit: 'PER_EVENT', inclusions: ['Full-day lawn hire', 'Valet parking', 'Bridal & groom green rooms', 'Basic stage décor'], exclusions: ['Catering', 'Photography'] },
      { name: 'Reception Hall Package', price: 180000, priceUnit: 'PER_EVENT', inclusions: ['Air-conditioned ballroom', 'Stage & lighting', 'Green room'], exclusions: ['Catering'] },
      { name: 'Intimate Function', price: 90000, priceUnit: 'PER_EVENT', inclusions: ['Poolside deck', 'Seating for 150'], exclusions: ['Décor', 'Catering'] },
    ],
    eventTypes: ['WEDDING', 'RECEPTION', 'MEHNDI', 'SANGEET', 'ENGAGEMENT', 'CORPORATE'],
    faqs: [
      { question: 'Do you allow outside caterers?', answer: 'Yes, from our approved partner list, or your own with a nominal royalty.' },
      { question: 'What is the guest capacity?', answer: '100 to 800 across the lawn and ballroom combined.' },
      { question: 'Is parking available?', answer: 'Yes — valet parking for up to 200 cars.' },
    ],
    awards: ['Best Garden Venue — Jaipur Wedding Awards 2025'],
    certifications: ['FSSAI-approved kitchen partners'],
  }, { upsert: true });
  await WeddingPlan.findOneAndUpdate({ weddingId: WED }, {
    weddingId: WED,
    theme: { name: 'Royal Marathi', colorPalette: ['#7B2D42', '#C5A47E', '#0E7C7B'], style: 'Traditional', moodBoardKeys: [] },
    budget: { total: 1500000, currency: 'INR', categories: [
      { name: 'Venue', allocated: 250000, spent: 100000 }, { name: 'Catering', allocated: 400000, spent: 0 },
      { name: 'Décor', allocated: 200000, spent: 0 }, { name: 'Photography', allocated: 150000, spent: 0 },
      { name: 'Attire & Jewellery', allocated: 300000, spent: 120000 }, { name: 'Misc', allocated: 200000, spent: 30000 },
    ] },
    ceremonies: [
      { type: 'HALDI', date: new Date('2026-10-29'), venue: 'Deshmukh Residence, Pune', startTime: '10:00', vendorIds: [] },
      { type: 'MEHNDI', date: new Date('2026-10-29'), venue: 'Royal Garden Banquets', startTime: '16:00', vendorIds: [VEN] },
      { type: 'SANGEET', date: new Date('2026-10-30'), venue: 'Royal Garden Banquets', startTime: '19:00', vendorIds: [VEN] },
      { type: 'WEDDING', date: new Date('2026-10-31'), venue: 'Royal Garden Banquets', startTime: '20:30', vendorIds: [VEN] },
    ],
    checklist: [
      { item: 'Book venue', done: true }, { item: 'Finalise catering menu', done: false },
      { item: 'Send invitations', done: false }, { item: 'Confirm photographer', done: false },
    ],
    muhuratDates: [
      { date: new Date('2026-10-31'), muhurat: 'Abhijit Muhurat 20:30–21:15', selected: true },
      { date: new Date('2026-11-14'), muhurat: 'Godhuli Lagna', selected: false },
    ],
  }, { upsert: true });
  console.info('  ✅ Mongo: 2 hero profiles, 1 chat thread, 1 vendor portfolio, 1 wedding plan');
}

// ── TEARDOWN ──────────────────────────────────────────────────────────────────
async function teardown(): Promise<void> {
  console.info('🧹 Removing demo-01 enrichment (0ade rows + demo Mongo)...');
  await db.execute(sql`DELETE FROM ticket_events    WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM ticket_messages  WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM support_tickets  WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM family_match_ratings WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM guests           WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM wedding_tasks    WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM vendor_reviews   WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM wedding_vendor_assignments WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM bookings         WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM notifications    WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM match_scores     WHERE id::text LIKE '0ade%'`);
  await db.execute(sql`DELETE FROM profile_views    WHERE id::text LIKE '0ade%'`);
  console.info('  ✅ Postgres 0ade rows removed (match_requests / UPDATEs left in place — re-run seed to restore)');
  const uri = process.env['MONGODB_URI'];
  if (uri) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    await ChatModel.deleteOne({ participants: [ADI, PRIYA] });
    await Portfolio.deleteOne({ vendorId: VEN });
    await WeddingPlan.deleteOne({ weddingId: WED });
    console.info('  ✅ Mongo demo docs removed (hero profiles_content left — used by profile pages)');
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const target = (process.env['DATABASE_URL'] ?? '').replace(/.*@/, '').replace(/\/.*/, '');
  console.info(`🎬 demo-01 enrichment — target DB host: ${target || '(unset)'}\n`);
  if (REMOVE) { await teardown(); return; }

  await seedProfileViews();
  await seedMatchRequests();
  await seedMatchScores();
  await seedNotifications();
  await seedVendorFlow();
  await seedWeddingBoard();
  await seedFamily();
  await seedSupport();
  await seedUpdates();

  // Fetch the accepted Aditya↔Priya request id for the chat's matchRequestId.
  const [accepted] = await db.select({ id: matchRequests.id }).from(matchRequests)
    .where(and(eq(matchRequests.senderId, ADI), eq(matchRequests.receiverId, PRIYA)));
  if (!accepted) throw new Error('accepted Aditya↔Priya match_request not found — cannot key chat');
  await seedMongo(accepted.id);

  console.info('\n✨ demo-01 enrichment complete.');
}

main()
  .then(async () => { await pool.end(); await mongoose.disconnect().catch(() => {}); process.exit(0); })
  .catch(async (e: unknown) => { console.error('❌ demo-01 failed:', e); await pool.end().catch(() => {}); await mongoose.disconnect().catch(() => {}); process.exit(1); });
