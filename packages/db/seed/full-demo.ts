/**
 * full-demo.ts — single-file demo seed for Colonel Deepak demo.
 * Runs in <90s, idempotent on re-run.
 *
 * Order: wipe → users → profiles + photos → vendors + services → match_scores
 *      → match_requests → wedding + ceremonies + tasks → guest_list + guests
 *      → notifications → mongo (chats + portfolios + profile_contents)
 *
 * userId → profileId boundary helper used at every transition (Architecture Rule #12).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import mongoose, { Schema, model, models } from 'mongoose';
// Phase 8 supply seeds (Units 8.1 + 8.2). Each owns its own pool; seed/index.ts
// exits the process, so they are not closed individually here.
import { seedPremiumPackages } from './premium-packages.js';
import { seedPostMarriage } from './post-marriage.js';
import { PLANS_CONSTANT } from '@smartshaadi/types';
import {
  user, profiles, profilePhotos, vendors, vendorServices, vendorEventTypes,
  matchScores, matchRequests, weddings, ceremonies, weddingTasks,
  guestLists, guests, notifications, plans,
} from '../schema/index.js';

config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

// ── Deterministic UUIDs ──────────────────────────────────────────────────────
const profileId = (n: number) => `11111111-1111-1111-1111-${n.toString().padStart(12, '0')}`;
const vendorId = (n: number) => `22222222-2222-2222-2222-${n.toString().padStart(12, '0')}`;
const serviceId = (n: number) => `33333333-3333-3333-3333-${n.toString().padStart(12, '0')}`;
const weddingId = '44444444-4444-4444-4444-444444444444';
const guestListId = '55555555-5555-5555-5555-555555555555';
const ceremonyId = (n: number) => `66666666-6666-6666-6666-${n.toString().padStart(12, '0')}`;
const matchScoreId = (n: number) => `77777777-7777-7777-7777-${n.toString().padStart(12, '0')}`;
const matchRequestId = (n: number) => `88888888-8888-8888-8888-${n.toString().padStart(12, '0')}`;

// ── Persona registry ─────────────────────────────────────────────────────────
const PRIYA_USER_ID  = 'seed-individual-001';
const ARJUN_USER_ID  = 'seed-individual-002';
const SUNITA_USER_ID = 'seed-family-001';
const ADMIN_USER_ID  = 'seed-admin-001';

const PRIYA_PROFILE_ID = profileId(1);
const ARJUN_PROFILE_ID = profileId(2);

// 16 male candidates for Priya's feed (12 domestic + a 4-strong NRI cohort)
type Candidate = {
  userId:     string;
  name:       string;
  phone:      string;
  city:       string;
  state:      string;
  community:  string;
  occupation: string;
  income:     string;
  age:        number;
  gunaScore:  number;       // 0-36
  totalScore: number;       // 0-100
  manglik:    boolean;
  active:     boolean;
  // ── NRI / cross-border (Unit 7.2) ────────────────────────────────────────
  //
  // These exist so the NRI_MATCHING_LIVE branch in matchmaking/filters.ts is
  // REACHABLE against seeded data. Before this cohort every seeded profile took
  // the column default `country_of_residence = 'IN'` with `open_to_nri_matching
  // = false`, so isCrossBorder() and hasOptedIntoNri() both returned false and
  // the bypass at filters.ts:250 could never be entered — turning the flag on
  // was a no-op you could not observe.
  //
  // The four rows below are chosen to exercise every arm of that condition:
  // see NRI_MATRIX in the verification script for which candidate proves what.
  country?:    string;      // ISO 3166-1 alpha-2; omitted → 'IN' (column default)
  citizenship?: string;
  residency?:  'CITIZEN' | 'PERM_RESIDENT' | 'WORK_VISA' | 'STUDENT_VISA' | 'DEPENDENT_VISA' | 'OTHER';
  relocate?:   boolean;
  nriOptIn?:   boolean;     // omitted → false (column default)
  tz?:         string;      // IANA zone; validated at runtime against Node ICU
  currency?:   'INR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'CAD' | 'AUD' | 'SGD';
};

const CANDIDATES: Candidate[] = [
  { userId: 'seed-cand-01', name: 'Karan Kapoor',     phone: '+918888880101', city: 'Delhi',     state: 'Delhi',         community: 'Punjabi Hindu',  occupation: 'Senior Consultant',  income: '40-60 LPA', age: 31, gunaScore: 34, totalScore: 92, manglik: false, active: true },
  { userId: 'seed-cand-02', name: 'Rohan Khurana',    phone: '+918888880102', city: 'Delhi',     state: 'Delhi',         community: 'Punjabi Hindu',  occupation: 'Product Manager',    income: '30-50 LPA', age: 30, gunaScore: 32, totalScore: 88, manglik: false, active: true },
  { userId: 'seed-cand-03', name: 'Aditya Bhalla',    phone: '+918888880103', city: 'Delhi',     state: 'Delhi',         community: 'Punjabi Hindu',  occupation: 'IB Analyst',         income: '40-60 LPA', age: 29, gunaScore: 30, totalScore: 86, manglik: false, active: true },
  { userId: 'seed-cand-04', name: 'Siddharth Anand',  phone: '+918888880104', city: 'Delhi',     state: 'Delhi',         community: 'Sikh',           occupation: 'Doctor (Cardio)',    income: '25-40 LPA', age: 32, gunaScore: 26, totalScore: 79, manglik: true,  active: true },
  { userId: 'seed-cand-05', name: 'Vivek Agarwal',    phone: '+918888880105', city: 'Mumbai',    state: 'Maharashtra',   community: 'Marwari',        occupation: 'Family Business',    income: '60-80 LPA', age: 33, gunaScore: 28, totalScore: 82, manglik: false, active: true },
  { userId: 'seed-cand-06', name: 'Nikhil Bajaj',     phone: '+918888880106', city: 'Mumbai',    state: 'Maharashtra',   community: 'Marwari',        occupation: 'VC Associate',       income: '45-65 LPA', age: 30, gunaScore: 24, totalScore: 76, manglik: false, active: true },
  { userId: 'seed-cand-07', name: 'Aarav Mehrotra',   phone: '+918888880107', city: 'Mumbai',    state: 'Maharashtra',   community: 'Sindhi',         occupation: 'Lawyer',             income: '20-35 LPA', age: 28, gunaScore: 22, totalScore: 71, manglik: false, active: true },
  { userId: 'seed-cand-08', name: 'Ravi Subramanian', phone: '+918888880108', city: 'Bangalore', state: 'Karnataka',     community: 'Tamil Brahmin',  occupation: 'Engineering Manager',income: '50-70 LPA', age: 32, gunaScore: 20, totalScore: 68, manglik: true,  active: true },
  { userId: 'seed-cand-09', name: 'Krishnan Iyer',    phone: '+918888880109', city: 'Bangalore', state: 'Karnataka',     community: 'Tamil Brahmin',  occupation: 'Tech Lead',          income: '35-55 LPA', age: 29, gunaScore: 18, totalScore: 64, manglik: false, active: false },
  { userId: 'seed-cand-10', name: 'Aditya Despande',  phone: '+918888880110', city: 'Pune',      state: 'Maharashtra',   community: 'Marathi Brahmin',occupation: 'Architect',          income: '15-25 LPA', age: 27, gunaScore: 16, totalScore: 60, manglik: true,  active: false },
  { userId: 'seed-cand-11', name: 'Arnav Banerjee',   phone: '+918888880111', city: 'Hyderabad', state: 'Telangana',     community: 'Bengali',        occupation: 'Data Scientist',     income: '25-40 LPA', age: 28, gunaScore: 14, totalScore: 55, manglik: false, active: false },
  // Was city 'New York' with the default country_of_residence='IN' and active:false —
  // a New York resident recorded as living in India, invisible to the feed. Now a
  // real US row, which is what makes the cross-border path demonstrable at all.
  { userId: 'seed-cand-12', name: 'Aryan Khanna',     phone: '+918888880112', city: 'New York',  state: 'NY',            community: 'Punjabi Hindu',  occupation: 'NRI Banker',         income: '70-90 LPA', age: 34, gunaScore: 13, totalScore: 52, manglik: false, active: true,
    country: 'US', citizenship: 'IN', residency: 'WORK_VISA',    relocate: true,  nriOptIn: true,  tz: 'America/New_York',  currency: 'USD' },

  // ── NRI cohort (Unit 7.2) — each row proves one arm of the bypass ──────────
  { userId: 'seed-cand-13', name: 'Dhruv Sethi',      phone: '+918888880113', city: 'London',    state: 'England',       community: 'Punjabi Hindu',  occupation: 'Risk Analyst',       income: '50-70 LPA', age: 31, gunaScore: 29, totalScore: 84, manglik: false, active: true,
    country: 'GB', citizenship: 'GB', residency: 'CITIZEN',      relocate: false, nriOptIn: true,  tz: 'Europe/London',     currency: 'GBP' },
  // Opted OUT: cross-border but one-sided. Must NOT surface, flag on or off.
  { userId: 'seed-cand-14', name: 'Imran Qureshi',    phone: '+918888880114', city: 'Dubai',     state: 'Dubai',         community: 'Punjabi Hindu',  occupation: 'Logistics Director', income: '45-65 LPA', age: 33, gunaScore: 25, totalScore: 77, manglik: false, active: true,
    country: 'AE', citizenship: 'IN', residency: 'WORK_VISA',    relocate: false, nriOptIn: false, tz: 'Asia/Dubai',        currency: 'AED' },
  { userId: 'seed-cand-15', name: 'Manav Chadha',     phone: '+918888880115', city: 'Toronto',   state: 'Ontario',       community: 'Sikh',           occupation: 'Data Engineer',      income: '40-60 LPA', age: 30, gunaScore: 27, totalScore: 80, manglik: false, active: true,
    country: 'CA', citizenship: 'CA', residency: 'PERM_RESIDENT', relocate: true, nriOptIn: true,  tz: 'America/Toronto',   currency: 'CAD' },
  // Domestic control: opted in, but SAME country as Priya. The bypass must not
  // fire — he still has to pass the ordinary distance check (Bengaluru vs Delhi,
  // so he must not surface). This is the safety property at filters.ts:247-249
  // expressed as data instead of a comment.
  { userId: 'seed-cand-16', name: 'Harsh Vardhan',    phone: '+918888880116', city: 'Bangalore', state: 'Karnataka',     community: 'Punjabi Hindu',  occupation: 'Startup Founder',    income: '60-80 LPA', age: 32, gunaScore: 31, totalScore: 87, manglik: false, active: true,
    country: 'IN', citizenship: 'IN', residency: 'CITIZEN',      relocate: false, nriOptIn: true,  tz: 'Asia/Kolkata',      currency: 'INR' },
];

// 6 vendors
type Vendor = {
  id: string;
  userId: string;
  ownerName: string;
  phone: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  verified: boolean;
  rating: string;
  totalReviews: number;
  tagline: string;
  description: string;
  yearsActive: number;
  priceMin: string;
  priceMax: string;
  services: { name: string; description: string; from: string; to: string; unit: string }[];
};

const VENDORS: Vendor[] = [
  {
    id: vendorId(1), userId: 'seed-vendor-001', ownerName: 'Meera Iyer', phone: '+918888880005',
    businessName: 'Royal Decor', category: 'DECORATION', city: 'Delhi', state: 'Delhi',
    verified: true, rating: '4.85', totalReviews: 168,
    tagline: 'Mandap couture for the modern Indian wedding',
    description: 'Royal Decor crafts editorial floral mandaps, hand-stitched backdrops, and statement centerpieces for over a decade. Serving Delhi-NCR since 2014.',
    yearsActive: 11, priceMin: '50000', priceMax: '200000',
    services: [
      { name: 'Mandap Floral Design', description: 'Marigold + rose mandap with traditional brass accents', from: '95000',  to: '150000', unit: 'event' },
      { name: 'Stage Backdrop Premium', description: '20ft hand-embroidered velvet backdrop with gold detailing', from: '120000', to: '200000', unit: 'event' },
      { name: 'Centerpieces (set of 12)', description: 'Brass urlis, candle clusters, fresh florals per table', from: '15000',  to: '35000',  unit: 'set' },
    ],
  },
  {
    id: vendorId(2), userId: 'seed-vendor-002', ownerName: 'Rohit Kapoor', phone: '+918888880011',
    businessName: 'Tandoor Tales', category: 'CATERING', city: 'Delhi', state: 'Delhi',
    verified: true, rating: '4.78', totalReviews: 213,
    tagline: 'North Indian feasts that grandparents approve',
    description: 'From dum biryani to live tandoor counters, Tandoor Tales has fed over 500 weddings across NCR. Pure-veg and Jain menus available.',
    yearsActive: 9, priceMin: '800', priceMax: '2500',
    services: [
      { name: 'Veg Plate Standard', description: '14-item buffet incl. live chaat counter', from: '800',  to: '1500', unit: 'plate' },
      { name: 'Live Counter (Tandoor)', description: 'Live tandoor + dosa + chaat for 200-pax event', from: '50000', to: '50000', unit: 'event' },
      { name: 'Premium Multi-cuisine', description: 'Continental + Mughlai + South Indian, 22 dishes', from: '1500', to: '2500', unit: 'plate' },
    ],
  },
  {
    id: vendorId(3), userId: 'seed-vendor-003', ownerName: 'Vikram Singh', phone: '+918888880012',
    businessName: 'Lens & Light Studios', category: 'PHOTOGRAPHY', city: 'Mumbai', state: 'Maharashtra',
    verified: true, rating: '4.92', totalReviews: 89,
    tagline: 'Stories told through quiet, honest frames',
    description: 'Editorial wedding photography and cinematic films. Featured in Vogue Wedding Show 2024. 200+ weddings shot since 2018.',
    yearsActive: 7, priceMin: '150000', priceMax: '400000',
    services: [
      { name: 'Wedding Day Coverage', description: '12 hours, 2 photographers, 600+ edited images, online gallery', from: '150000', to: '250000', unit: 'event' },
      { name: 'Pre-wedding Shoot', description: 'Half-day editorial shoot at scenic location, 80 edited images', from: '35000',  to: '80000',  unit: 'event' },
      { name: 'Cinematic Wedding Film', description: '5-min highlight + 30-min long film + raw footage + drone', from: '200000', to: '400000', unit: 'event' },
    ],
  },
  {
    id: vendorId(4), userId: 'seed-vendor-004', ownerName: 'Acharya Rameshwar', phone: '+918888880013',
    businessName: 'Acharya Rameshwar', category: 'PRIEST', city: 'Delhi', state: 'Delhi',
    verified: true, rating: '4.97', totalReviews: 312,
    tagline: 'Vedic ceremonies, performed with depth',
    description: 'Third-generation priest with 25+ years officiating Hindu and Sikh weddings. Reads Sanskrit, Hindi, English, Punjabi.',
    yearsActive: 27, priceMin: '10000', priceMax: '35000',
    services: [
      { name: 'Engagement (Roka) Ceremony', description: 'Sankalp + ring exchange + blessings, 60-90 min', from: '15000', to: '15000', unit: 'event' },
      { name: 'Wedding Day (Pheras + Saptapadi)', description: 'Full traditional ceremony, 3-4 hours, all rituals', from: '35000', to: '35000', unit: 'event' },
      { name: 'Sangeet/Mehendi Blessing', description: 'Brief ceremonial puja, 30 min, before family functions', from: '10000', to: '10000', unit: 'event' },
    ],
  },
  {
    id: vendorId(5), userId: 'seed-vendor-005', ownerName: 'Asha Gupta', phone: '+918888880014',
    businessName: 'Asha Boutique', category: 'CLOTHING', city: 'Mumbai', state: 'Maharashtra',
    verified: false, rating: '4.62', totalReviews: 47,
    tagline: 'Couture for every ceremony, hand-finished',
    description: 'Bridal lehengas, sherwanis, and reception gowns hand-embroidered in our Bandra atelier. By appointment only.',
    yearsActive: 6, priceMin: '25000', priceMax: '150000',
    services: [
      { name: 'Bespoke Sherwani', description: 'Hand-embroidered sherwani with stole + churidaar, 4 fittings', from: '25000', to: '80000',  unit: 'piece' },
      { name: 'Bridal Lehenga',   description: 'Heavy zardozi lehenga + dupatta + blouse, 6 fittings, 60-day lead', from: '50000', to: '150000', unit: 'piece' },
      { name: 'Reception Gown',   description: 'Indo-Western gown for reception, 3 fittings', from: '40000', to: '100000', unit: 'piece' },
    ],
  },
  {
    id: vendorId(6), userId: 'seed-vendor-006', ownerName: 'DJ Aman', phone: '+918888880015',
    businessName: 'Beats Brigade', category: 'MUSIC', city: 'Delhi', state: 'Delhi',
    verified: false, rating: '4.45', totalReviews: 31,
    tagline: 'Sangeet anthems and dance floors that don\'t empty',
    description: 'Wedding-specific DJs and live sound. Bollywood, Punjabi, EDM, sufi-fusion. Dholak + DJ combo on request.',
    yearsActive: 4, priceMin: '50000', priceMax: '120000',
    services: [
      { name: 'Sangeet DJ Set',          description: '4-hour set + emcee + lights + smoke + DJ Aman', from: '50000', to: '50000', unit: 'event' },
      { name: 'Wedding Sound + DJ',      description: 'Day + evening coverage, dual-zone PA, 8 hours', from: '80000', to: '80000', unit: 'event' },
      { name: 'Reception Premium Pack', description: 'DJ + dholak + LED wall + dance lights, 6 hours', from: '120000', to: '120000', unit: 'event' },
    ],
  },
];

// ── Wipe demo data (preserve user/profiles to keep IDs stable) ───────────────
// ── Plans (subscription tiers, reference data — wipeDemo skips) ─────────────
// Shared constant from @smartshaadi/db/constants/plans.ts
const PLAN_ROWS = PLANS_CONSTANT;

/**
 * Exported so plans can be synced on their own, without the demo data.
 * Plans are reference data, not demo data — production needs them current, and
 * running the full demo seed against production would create fake users.
 */
export async function seedPlansOnly(): Promise<void> {
  await seedPlans();
}

async function seedPlans() {
  console.info('💎 seeding plans...');
  for (const row of PLAN_ROWS) {
    // CONVERGE, don't skip. This was `onConflictDoNothing()`, which meant a
    // price change in packages/types/src/plans.ts reached new environments but
    // never existing ones: the row was already there, so the insert was
    // discarded silently. Production sat on the pre-repricing numbers for days
    // that way — PREMIUM_Y was live at 22999.00 against a source of truth of
    // 7999.00, and neither quarterly plan existed at all.
    //
    // `code` is the natural key (unique). Everything derived from the constant
    // is refreshed; nothing environment-specific is: razorpay_plan_id is
    // deliberately NOT in the update set, because it is provisioned per
    // environment in Razorpay and re-seeding must not clear it.
    await db
      .insert(plans)
      .values(row)
      .onConflictDoUpdate({
        target: plans.code,
        set: {
          name:     row.name,
          tier:     row.tier,
          interval: row.interval,
          amount:   row.amount,
          features: row.features,
          active:   row.active,
        },
      });
  }
  console.info(`  ✅ Plans: ${PLAN_ROWS.length} (upserted to match source of truth)`);
}

async function wipeDemo() {
  console.info('🧹 wiping demo tables...');
  // Bulk CASCADE truncate — covers all FK chains. Order doesn't matter with CASCADE.
  // Includes profiles + user (last) so deterministic IDs can be inserted cleanly.
  await db.execute(sql`TRUNCATE TABLE
    notifications,
    guests, guest_lists,
    wedding_tasks, ceremonies, wedding_vendor_assignments, weddings,
    match_scores, match_requests, blocked_users, match_request_reports,
    bookings, payments, escrow_accounts,
    order_items, orders, products,
    rental_bookings, rental_items,
    vendor_event_types, vendor_services, vendor_reviews, vendor_favorites, vendor_inquiries, vendor_blocked_dates,
    vendors,
    -- Phase 8 Unit 8.2. service_enquiries.customer_id references the user table
    -- with the default RESTRICT, so the seed-user DELETE below would FAIL once
    -- anyone had raised a demo enquiry, making the seed un-rerunnable.
    -- Truncating it here keeps that delete unblocked.
    -- (8.1 package enquiries need no entry: they live in vendor_inquiries above,
    -- and premium_packages is reached by CASCADE from vendors.)
    service_enquiries,
    profile_photos, profile_sections, safety_mode_unlocks,
    kyc_audit_log, kyc_documents, kyc_appeals, kyc_verifications,
    profiles
    CASCADE`);
  // Clear seed-* users too so we can re-create them with the correct names/roles.
  await db.execute(sql`DELETE FROM "user" WHERE id LIKE 'seed-%'`);
}

// ── Users + profiles ─────────────────────────────────────────────────────────
async function seedUsers() {
  console.info('👤 seeding users + profiles...');

  const allUsers = [
    { id: PRIYA_USER_ID,  name: 'Priya Khanna',     email: 'priya@test.smartshaadi.co.in',     phone: '+918888880001', role: 'INDIVIDUAL' },
    { id: ARJUN_USER_ID,  name: 'Arjun Malhotra',   email: 'arjun@test.smartshaadi.co.in',     phone: '+918888880002', role: 'INDIVIDUAL' },
    { id: SUNITA_USER_ID, name: 'Sunita Khanna',    email: 'sunita@test.smartshaadi.co.in',    phone: '+918888880050', role: 'FAMILY_MEMBER' },
    { id: ADMIN_USER_ID,  name: 'Demo Admin',       email: 'admin@test.smartshaadi.co.in',     phone: '+918888880006', role: 'ADMIN' },
    ...CANDIDATES.map(c => ({ id: c.userId, name: c.name, email: `${c.userId}@test.smartshaadi.co.in`, phone: c.phone, role: 'INDIVIDUAL' })),
    ...VENDORS.map(v => ({ id: v.userId, name: v.ownerName, email: `${v.userId}@test.smartshaadi.co.in`, phone: v.phone, role: 'VENDOR' })),
  ];

  for (const u of allUsers) {
    await db.insert(user).values({
      id: u.id, name: u.name, email: u.email, emailVerified: true,
      phoneNumber: u.phone, phoneNumberVerified: true,
      role: u.role, status: 'ACTIVE',
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  // Profiles — Priya, Arjun, Sunita, 16 candidates.
  //
  // Priya opts into NRI matching because the bypass is bilateral: with her opted
  // out, no cross-border candidate can surface however the candidates are set up,
  // and the flag-on demo shows an empty feed.
  type ProfileRow = {
    id: string; userId: string; completeness: number; isActive: boolean;
    city: string; state: string;
    country?: string; citizenship?: string; residency?: Candidate['residency'];
    relocate?: boolean; nriOptIn?: boolean; tz?: string; currency?: Candidate['currency'];
  };
  const profileRows: ProfileRow[] = [
    { id: PRIYA_PROFILE_ID,        userId: PRIYA_USER_ID,  completeness: 92, isActive: true,  city: 'New Delhi', state: 'Delhi',
      country: 'IN', citizenship: 'IN', residency: 'CITIZEN', relocate: true, nriOptIn: true, tz: 'Asia/Kolkata', currency: 'INR' },
    { id: ARJUN_PROFILE_ID,        userId: ARJUN_USER_ID,  completeness: 96, isActive: true,  city: 'New Delhi', state: 'Delhi' },
    { id: profileId(3),            userId: SUNITA_USER_ID, completeness: 60, isActive: true,  city: 'New Delhi', state: 'Delhi' },
    ...CANDIDATES.map((c, i) => ({ id: profileId(10 + i),  userId: c.userId, completeness: 80 + (i % 15), isActive: c.active, city: c.city, state: c.state,
      ...(c.country     !== undefined ? { country: c.country }         : {}),
      ...(c.citizenship !== undefined ? { citizenship: c.citizenship } : {}),
      ...(c.residency   !== undefined ? { residency: c.residency }     : {}),
      ...(c.relocate    !== undefined ? { relocate: c.relocate }       : {}),
      ...(c.nriOptIn    !== undefined ? { nriOptIn: c.nriOptIn }       : {}),
      ...(c.tz          !== undefined ? { tz: c.tz }                   : {}),
      ...(c.currency    !== undefined ? { currency: c.currency }       : {}),
    })),
  ];

  for (const p of profileRows) {
    await db.insert(profiles).values({
      id: p.id, userId: p.userId,
      verificationStatus: 'VERIFIED', premiumTier: 'FREE',
      profileCompleteness: p.completeness, isActive: p.isActive,
      // NRI columns. countryOfResidence / willingToRelocate / openToNriMatching /
      // displayCurrency are NOT NULL with defaults, so they are always written;
      // citizenship / residencyStatus / ianaTimezone are nullable and stay null
      // for the domestic rows that never stated them.
      countryOfResidence: p.country  ?? 'IN',
      willingToRelocate:  p.relocate ?? false,
      openToNriMatching:  p.nriOptIn ?? false,
      displayCurrency:    p.currency ?? 'INR',
      ...(p.citizenship !== undefined ? { citizenship: p.citizenship }    : {}),
      ...(p.residency   !== undefined ? { residencyStatus: p.residency }  : {}),
      ...(p.tz          !== undefined ? { ianaTimezone: p.tz }            : {}),
      lastActiveAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    })
      // NOT onConflictDoNothing. Priya and cand-12 already exist in every
      // previously-seeded database, so do-nothing would leave their NRI columns
      // at the old defaults, print a success line, and produce a demo where the
      // flag still does nothing — the failure mode is a green run that changed
      // nothing. Only the NRI columns are re-asserted; isActive and
      // profileCompleteness are left alone so a re-seed cannot clobber state a
      // demo run has legitimately moved on from.
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          countryOfResidence: p.country  ?? 'IN',
          willingToRelocate:  p.relocate ?? false,
          openToNriMatching:  p.nriOptIn ?? false,
          displayCurrency:    p.currency ?? 'INR',
          citizenship:        p.citizenship ?? null,
          residencyStatus:    p.residency   ?? null,
          ianaTimezone:       p.tz          ?? null,
          updatedAt:          new Date(),
        },
      });
  }

  // Profile photos — 4 for Priya, 5 for Arjun. Keys live under the `photos/`
  // prefix so the /__media redirect (prefix-allowlisted) resolves them, and we
  // drop a bundled placeholder image at .data/mock-r2/<key> so USE_MOCK_SERVICES
  // dev serves real bytes (no broken-image icons, no console 404s).
  const photoRows = [
    ...Array.from({ length: 4 }).map((_, i) => ({ profileId: PRIYA_PROFILE_ID, key: `photos/seed/priya-${i + 1}.png`, isPrimary: i === 0, order: i })),
    ...Array.from({ length: 5 }).map((_, i) => ({ profileId: ARJUN_PROFILE_ID, key: `photos/seed/arjun-${i + 1}.png`, isPrimary: i === 0, order: i })),
  ];
  const MOCK_R2_ROOT = resolve(__dirname, '../../../apps/api/.data/mock-r2');
  const placeholderBytes = readFileSync(resolve(__dirname, 'assets/placeholder-avatar.png'));
  for (const ph of photoRows) {
    await db.insert(profilePhotos).values({
      profileId: ph.profileId, r2Key: ph.key, isPrimary: ph.isPrimary, displayOrder: ph.order,
    }).onConflictDoNothing();
    const filePath = resolve(MOCK_R2_ROOT, ph.key);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, placeholderBytes);
  }
}

// ── Vendors + services + event types ─────────────────────────────────────────
async function seedVendors() {
  console.info('🏪 seeding 6 vendors + services...');
  for (const v of VENDORS) {
    await db.insert(vendors).values({
      id: v.id, userId: v.userId,
      businessName: v.businessName, category: v.category as 'DECORATION',
      city: v.city, state: v.state, verified: v.verified,
      rating: v.rating, totalReviews: v.totalReviews,
      tagline: v.tagline, description: v.description,
      yearsActive: v.yearsActive,
      priceMin: v.priceMin, priceMax: v.priceMax,
      isActive: true,
      phone: v.phone,
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();

    let svcIdx = 1;
    for (const s of v.services) {
      await db.insert(vendorServices).values({
        id: serviceId(VENDORS.indexOf(v) * 10 + svcIdx),
        vendorId: v.id,
        name: s.name, description: s.description,
        priceFrom: s.from, priceTo: s.to, priceUnit: s.unit,
        isActive: true,
      }).onConflictDoNothing();
      svcIdx++;
    }

    const eventTypes: ('WEDDING' | 'HALDI' | 'MEHNDI' | 'SANGEET' | 'ENGAGEMENT' | 'RECEPTION')[] =
      ['WEDDING', 'HALDI', 'MEHNDI', 'SANGEET', 'ENGAGEMENT', 'RECEPTION'];
    for (const eventType of eventTypes) {
      await db.insert(vendorEventTypes).values({ vendorId: v.id, eventType, available: true }).onConflictDoNothing();
    }
  }
}

// ── Match scores + match requests ────────────────────────────────────────────
async function seedMatches() {
  console.info('💞 seeding match_scores + match_requests...');
  // Priya × Arjun
  await db.insert(matchScores).values({
    id: matchScoreId(0),
    profileA: PRIYA_PROFILE_ID, profileB: ARJUN_PROFILE_ID,
    totalScore: 91, gunaMilanScore: 28,
    breakdown: {
      guna: { varna: 1, vashya: 2, tara: 3, yoni: 3, grahaMaitri: 4, gana: 6, bhakoot: 4, nadi: 5, total: 28 },
      reciprocal: { ageMatch: 95, locationMatch: 100, communityMatch: 100, careerMatch: 90, lifestyleMatch: 92 },
    },
  }).onConflictDoNothing();

  // Priya × 12 candidates (await in series — pool stays healthy)
  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i]!;
    await db.insert(matchScores).values({
      id: matchScoreId(i + 1),
      profileA: PRIYA_PROFILE_ID, profileB: profileId(10 + i),
      totalScore: c.totalScore, gunaMilanScore: c.gunaScore,
      breakdown: {
        guna: { total: c.gunaScore, manglik: c.manglik },
        reciprocal: { ageMatch: 80 + (i % 15), locationMatch: c.city === 'New Delhi' ? 100 : 70 },
      },
    }).onConflictDoNothing();
  }

  // Match requests
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  // Priya → Arjun ACCEPTED 7 days ago
  await db.insert(matchRequests).values({
    id: matchRequestId(1),
    senderId: PRIYA_PROFILE_ID, receiverId: ARJUN_PROFILE_ID,
    status: 'ACCEPTED', message: 'Hi, your profile resonates — would love to connect.',
    respondedAt: daysAgo(7), createdAt: daysAgo(8), updatedAt: daysAgo(7),
  }).onConflictDoNothing();

  // 2 PENDING incoming for Priya
  await db.insert(matchRequests).values({
    id: matchRequestId(2),
    senderId: profileId(10), receiverId: PRIYA_PROFILE_ID,
    status: 'PENDING', message: 'Hello Priya, thoughtful profile — would like to learn more.',
    createdAt: daysAgo(2), updatedAt: daysAgo(2),
  }).onConflictDoNothing();

  await db.insert(matchRequests).values({
    id: matchRequestId(3),
    senderId: profileId(11), receiverId: PRIYA_PROFILE_ID,
    status: 'PENDING', message: 'Both our families are from Delhi — felt aligned.',
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  }).onConflictDoNothing();

  // 1 SENT outgoing
  await db.insert(matchRequests).values({
    id: matchRequestId(4),
    senderId: PRIYA_PROFILE_ID, receiverId: profileId(12),
    status: 'PENDING', message: 'Felt our values aligned — would like to talk.',
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
  }).onConflictDoNothing();
}

// ── Wedding + ceremonies + tasks ─────────────────────────────────────────────
async function seedWedding() {
  console.info('💒 seeding wedding + 7 ceremonies + 30 tasks...');

  await db.insert(weddings).values({
    id: weddingId,
    profileId: PRIYA_PROFILE_ID,
    partnerProfileId: ARJUN_PROFILE_ID,
    weddingDate: '2026-12-05',
    venueName: 'The Imperial, New Delhi',
    venueCity: 'New Delhi',
    venueAddress: 'Janpath Lane, Connaught Place, New Delhi 110001',
    budgetTotal: '2500000',
    guestCount: 350,
    status: 'PLANNING',
    title: 'Priya × Arjun · December 2026',
    brideName: 'Priya Khanna',
    groomName: 'Arjun Malhotra',
    hashtag: '#PriyaWedsArjun2026',
    primaryColor: '#7B2D42',
    createdAt: new Date(), updatedAt: new Date(),
  }).onConflictDoNothing();

  // 7 ceremonies
  const cers: { id: string; type: 'WEDDING' | 'HALDI' | 'MEHNDI' | 'SANGEET' | 'ENGAGEMENT' | 'RECEPTION' | 'OTHER'; date: string; venue: string; status: 'SCHEDULED' | 'COMPLETED'; startTime: string }[] = [
    { id: ceremonyId(1), type: 'OTHER',      date: '2026-09-15', venue: 'Khanna residence',         status: 'COMPLETED',  startTime: '11:00' }, // Roka
    { id: ceremonyId(2), type: 'ENGAGEMENT', date: '2026-10-20', venue: 'The Leela, New Delhi',     status: 'COMPLETED',  startTime: '19:00' },
    { id: ceremonyId(3), type: 'HALDI',      date: '2026-12-03', venue: 'Khanna residence garden', status: 'SCHEDULED',  startTime: '10:00' },
    { id: ceremonyId(4), type: 'MEHNDI',     date: '2026-12-03', venue: 'Khanna residence lawn',   status: 'SCHEDULED',  startTime: '17:00' },
    { id: ceremonyId(5), type: 'SANGEET',    date: '2026-12-04', venue: 'The Imperial Ballroom',   status: 'SCHEDULED',  startTime: '19:30' },
    { id: ceremonyId(6), type: 'WEDDING',    date: '2026-12-05', venue: 'The Imperial Lawn',       status: 'SCHEDULED',  startTime: '17:00' },
    { id: ceremonyId(7), type: 'RECEPTION',  date: '2026-12-06', venue: 'Taj Mahal Hotel',         status: 'SCHEDULED',  startTime: '19:00' },
  ];
  for (const c of cers) {
    await db.insert(ceremonies).values({
      id: c.id, weddingId, type: c.type, date: c.date, venue: c.venue,
      status: c.status, startTime: c.startTime,
    }).onConflictDoNothing();
  }

  // 30 tasks
  const taskTitles: { title: string; status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'; priority: 'LOW' | 'MEDIUM' | 'HIGH'; cat: string; due?: string }[] = [
    { title: 'Finalise venue booking',                status: 'COMPLETED',   priority: 'HIGH',   cat: 'venue',         due: '2026-08-15' },
    { title: 'Roka ceremony',                         status: 'COMPLETED',   priority: 'HIGH',   cat: 'ceremony',      due: '2026-09-15' },
    { title: 'Engagement ring purchase',              status: 'COMPLETED',   priority: 'HIGH',   cat: 'jewellery',     due: '2026-10-10' },
    { title: 'Engagement ceremony',                   status: 'COMPLETED',   priority: 'HIGH',   cat: 'ceremony',      due: '2026-10-20' },
    { title: 'Save-the-date design',                  status: 'COMPLETED',   priority: 'MEDIUM', cat: 'invitation',    due: '2026-09-30' },
    { title: 'Save-the-date dispatch',                status: 'COMPLETED',   priority: 'MEDIUM', cat: 'invitation',    due: '2026-10-10' },
    { title: 'Photographer shortlist',                status: 'COMPLETED',   priority: 'HIGH',   cat: 'vendor',        due: '2026-09-20' },
    { title: 'Photographer signed (Lens & Light)',    status: 'COMPLETED',   priority: 'HIGH',   cat: 'vendor',        due: '2026-10-05' },
    { title: 'Decorator shortlist',                   status: 'COMPLETED',   priority: 'HIGH',   cat: 'vendor',        due: '2026-10-15' },
    { title: 'Decorator signed (Royal Decor)',        status: 'COMPLETED',   priority: 'HIGH',   cat: 'vendor',        due: '2026-11-01' },
    { title: 'Caterer tasting + booking',             status: 'COMPLETED',   priority: 'HIGH',   cat: 'catering',      due: '2026-11-08' },
    { title: 'Bridal lehenga first fitting',          status: 'COMPLETED',   priority: 'MEDIUM', cat: 'clothing',      due: '2026-10-25' },

    { title: 'Mehendi artist booking',                status: 'IN_PROGRESS', priority: 'HIGH',   cat: 'vendor',        due: '2026-11-15' },
    { title: 'Sangeet choreography',                  status: 'IN_PROGRESS', priority: 'MEDIUM', cat: 'sangeet',       due: '2026-11-20' },
    { title: 'Wedding card final design',             status: 'IN_PROGRESS', priority: 'HIGH',   cat: 'invitation',    due: '2026-11-10' },
    { title: 'Bridal lehenga second fitting',         status: 'IN_PROGRESS', priority: 'MEDIUM', cat: 'clothing',      due: '2026-11-12' },
    { title: 'Groom sherwani fitting',                status: 'IN_PROGRESS', priority: 'MEDIUM', cat: 'clothing',      due: '2026-11-15' },
    { title: 'Hotel block bookings',                  status: 'IN_PROGRESS', priority: 'HIGH',   cat: 'logistics',     due: '2026-11-18' },

    { title: 'Wedding card dispatch',                 status: 'TODO',        priority: 'HIGH',   cat: 'invitation',    due: '2026-11-15' },
    { title: 'Mehendi artist confirmation',           status: 'TODO',        priority: 'HIGH',   cat: 'vendor',        due: '2026-11-20' },
    { title: 'Acharya final visit + ritual brief',    status: 'TODO',        priority: 'HIGH',   cat: 'priest',        due: '2026-11-25' },
    { title: 'Sound + DJ confirmation',               status: 'TODO',        priority: 'MEDIUM', cat: 'vendor',        due: '2026-11-22' },
    { title: 'Transport coordination',                status: 'TODO',        priority: 'MEDIUM', cat: 'logistics',     due: '2026-11-28' },
    { title: 'Final guest count to caterer',          status: 'TODO',        priority: 'HIGH',   cat: 'catering',      due: '2026-11-30' },
    { title: 'Welcome bag assembly',                  status: 'TODO',        priority: 'LOW',    cat: 'logistics',     due: '2026-12-01' },
    { title: 'Bridal hair + makeup trial',            status: 'TODO',        priority: 'HIGH',   cat: 'beauty',        due: '2026-11-28' },
    { title: 'Honeymoon visa + tickets',              status: 'TODO',        priority: 'HIGH',   cat: 'honeymoon',     due: '2026-11-20' },
    { title: 'Insurance + legal paperwork',           status: 'TODO',        priority: 'MEDIUM', cat: 'admin',         due: '2026-11-15' },
    { title: 'Couple shoot with Lens & Light',        status: 'TODO',        priority: 'MEDIUM', cat: 'photography',   due: '2026-11-25' },

    { title: 'Mehendi artist deposit (overdue)',      status: 'OVERDUE',     priority: 'HIGH',   cat: 'vendor',        due: '2026-11-05' },
  ];

  for (let i = 0; i < taskTitles.length; i++) {
    const t = taskTitles[i]!;
    await db.insert(weddingTasks).values({
      id: `99999999-9999-9999-9999-${i.toString().padStart(12, '0')}`,
      weddingId, title: t.title, description: '',
      dueDate: t.due ?? null, status: t.status, priority: t.priority,
      assignedTo: i % 3 === 0 ? PRIYA_USER_ID : i % 3 === 1 ? ARJUN_USER_ID : SUNITA_USER_ID,
      category: t.cat,
      completedAt: t.status === 'COMPLETED' ? new Date(Date.now() - 86400000 * (30 - i)) : null,
    }).onConflictDoNothing();
  }
}

// ── Guest list (50 guests) ───────────────────────────────────────────────────
async function seedGuests() {
  console.info('👥 seeding guest list (50 guests)...');
  await db.insert(guestLists).values({
    id: guestListId, weddingId, createdBy: PRIYA_USER_ID,
    createdAt: new Date(), updatedAt: new Date(),
  }).onConflictDoNothing();

  const FIRST = ['Aanya','Arjun','Anika','Aditya','Bhavna','Chirag','Deepak','Diya','Esha','Farhan',
    'Gauri','Harsh','Isha','Jai','Kavya','Lakshmi','Mihir','Naina','Om','Pooja',
    'Quasar','Rohan','Sanya','Tara','Uma','Vikas','Wamika','Xena','Yash','Zara',
    'Aakash','Bina','Charu','Devika','Ekta','Gita','Hetal','Indira','Jaya','Kiran',
    'Madhu','Niharika','Ojas','Pavan','Rishabh','Saroj','Tanvi','Urmila','Vijay','Yamini'];
  const LAST = ['Khanna','Malhotra','Sharma','Iyer','Patel','Verma','Mehta','Gupta','Kapoor','Bhatia'];
  const RELS = ['Cousin (bride side)','Uncle (bride)','Aunt (bride)','School friend (bride)','College friend (bride)',
    'Cousin (groom side)','Uncle (groom)','Aunt (groom)','Office colleague (groom)','Close family friend',
    'Father\'s colleague','Mother\'s friend','Neighbor','Mentor','Cousin'];
  const SIDES = ['BRIDE', 'GROOM'];
  const MEALS: ('VEG' | 'NON_VEG' | 'JAIN' | 'EGGETARIAN' | 'NO_PREFERENCE')[] = ['VEG','VEG','VEG','NON_VEG','JAIN','NO_PREFERENCE','EGGETARIAN'];

  const distribution: { rsvp: 'YES' | 'NO' | 'MAYBE' | 'PENDING'; n: number }[] = [
    { rsvp: 'YES', n: 30 }, { rsvp: 'NO', n: 8 }, { rsvp: 'MAYBE', n: 6 }, { rsvp: 'PENDING', n: 6 },
  ];

  let idx = 0;
  for (const dist of distribution) {
    for (let j = 0; j < dist.n; j++) {
      const f = FIRST[idx % FIRST.length]!;
      const l = LAST[idx % LAST.length]!;
      const room = idx < 18 ? `RM-${(101 + idx).toString()}` : null;
      const plusOnes = idx % 4 === 0 ? 1 : 0;
      await db.insert(guests).values({
        id: `aaaaaaaa-aaaa-aaaa-aaaa-${idx.toString().padStart(12, '0')}`,
        guestListId,
        name: `${f} ${l}`,
        phone: `+9199998${idx.toString().padStart(5, '0')}`,
        email: `${f.toLowerCase()}.${l.toLowerCase()}@example.com`,
        relationship: RELS[idx % RELS.length],
        side: SIDES[idx % 2],
        rsvpStatus: dist.rsvp,
        mealPreference: MEALS[idx % MEALS.length]!,
        roomNumber: room,
        plusOnes,
        plusOneNames: plusOnes > 0 ? [`${FIRST[(idx + 7) % FIRST.length]} ${l}`] : null,
        ageGroup: idx === 12 ? 'CHILD' : 'ADULT',
        isVip: idx < 5,
      }).onConflictDoNothing();
      idx++;
    }
  }
}

// ── Notifications (8 for Priya, 3 unread) ────────────────────────────────────
async function seedNotifications() {
  console.info('🔔 seeding notifications...');
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60_000);
  const items: { type: 'MATCH_ACCEPTED' | 'NEW_MESSAGE' | 'BOOKING_CONFIRMED' | 'TASK_DUE' | 'PAYMENT_RECEIVED' | 'SYSTEM'; title: string; body: string; read: boolean; mins: number }[] = [
    { type: 'MATCH_ACCEPTED',     title: 'Arjun accepted your request',           body: 'You can now chat and share contact details.',         read: true,  mins: 60 * 24 * 7 },
    { type: 'NEW_MESSAGE',        title: 'New message from Arjun',                body: '"Looking forward to tomorrow!"',                     read: false, mins: 120 },
    { type: 'BOOKING_CONFIRMED',  title: 'Royal Decor confirmed your booking',    body: 'Mandap Floral · 5 Dec 2026',                        read: true,  mins: 60 * 24 * 3 },
    { type: 'BOOKING_CONFIRMED',  title: 'Lens & Light confirmed your booking',   body: 'Wedding Day Coverage · 5 Dec 2026',                 read: true,  mins: 60 * 24 * 5 },
    { type: 'TASK_DUE',           title: 'Wedding card dispatch due in 14 days',  body: 'Kindly finalise printer + dispatch list.',           read: false, mins: 60 * 4 },
    { type: 'SYSTEM',             title: 'Profile completeness milestone — 92%',  body: 'Add a hobby photo to reach 95%.',                   read: true,  mins: 60 * 24 * 10 },
    { type: 'BOOKING_CONFIRMED',  title: 'Acharya Rameshwar confirmed',           body: 'Wedding ceremony · 5 Dec 2026 · 17:00',             read: true,  mins: 60 * 24 * 2 },
    { type: 'SYSTEM',             title: 'Welcome bag samples shipped',           body: 'Tracking #SS123987 — expected 3 days.',              read: false, mins: 60 * 6 },
  ];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    await db.insert(notifications).values({
      id: `bbbbbbbb-bbbb-bbbb-bbbb-${i.toString().padStart(12, '0')}`,
      userId: PRIYA_USER_ID,
      type: it.type, title: it.title, body: it.body,
      read: it.read,
      createdAt: minsAgo(it.mins),
    }).onConflictDoNothing();
  }
}

// ── Mongo content (chats + portfolios + profile_contents) ────────────────────
const profileContentSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  personal: Schema.Types.Mixed, education: Schema.Types.Mixed, profession: Schema.Types.Mixed,
  family: Schema.Types.Mixed, location: Schema.Types.Mixed, lifestyle: Schema.Types.Mixed,
  horoscope: Schema.Types.Mixed, partnerPreferences: Schema.Types.Mixed,
  safetyMode: Schema.Types.Mixed, aboutMe: String,
}, { collection: 'profiles_content', timestamps: true });

const messageSubSchema = new Schema({
  senderId: { type: String, required: true },
  content:  { type: String, required: true },
  contentHi:{ type: String },
  sentAt:   { type: Date, required: true },
  readAt:   { type: Date },
  type:     { type: String, default: 'TEXT' },
}, { _id: true });

const chatSchema = new Schema({
  matchId: { type: String, required: true, index: true },
  participants: [String],
  messages: [messageSubSchema],
}, { collection: 'chats', timestamps: true });

const portfolioSchema = new Schema({
  vendorId: { type: String, required: true, unique: true, index: true },
  about: String, tagline: String,
  portfolioItems: [{ title: String, imageUrl: String, caption: String }],
  reviews: [{ author: String, rating: Number, text: String, date: Date }],
}, { collection: 'vendor_portfolios', timestamps: true });

const ProfileContentModel = (models['ProfileContent'] ?? model('ProfileContent', profileContentSchema)) as ReturnType<typeof model>;
const ChatModel = (models['Chat'] ?? model('Chat', chatSchema)) as ReturnType<typeof model>;
const PortfolioModel = (models['VendorPortfolio'] ?? model('VendorPortfolio', portfolioSchema)) as ReturnType<typeof model>;

const PRIYA_PROFILE_CONTENT = {
  userId: PRIYA_USER_ID,
  personal: {
    fullName: 'Priya Khanna', dob: new Date('1998-08-14'), gender: 'FEMALE',
    height: 165, complexion: 'FAIR', maritalStatus: 'NEVER_MARRIED',
    motherTongue: 'Punjabi', religion: 'Hindu', caste: 'Khatri', subCaste: 'Punjabi Khatri',
    manglik: false, gotra: 'Bharadwaj',
  },
  education: { degree: 'B.Tech', college: 'IIT Delhi', fieldOfStudy: 'Computer Science', year: 2019 },
  profession: { occupation: 'Senior Software PM', employer: 'Microsoft', incomeRange: '30-50 LPA',
    workLocation: 'Delhi NCR', employerType: 'PRIVATE', designation: 'Senior PM' },
  family: {
    fatherName: 'Col. Vikram Khanna (Retd.)', fatherOccupation: 'Retired Army Colonel',
    motherName: 'Sunita Khanna', motherOccupation: 'Homemaker',
    siblings: [{ name: 'Karan Khanna', married: false, occupation: 'Student (DU)' }],
    familyType: 'NUCLEAR', familyValues: 'TRADITIONAL_MODERATE', familyStatus: 'UPPER_MIDDLE',
    nativePlace: 'Amritsar, Punjab',
  },
  location: { city: 'New Delhi', state: 'Delhi', country: 'India' },
  lifestyle: {
    diet: 'VEG', smoking: 'NEVER', drinking: 'OCCASIONALLY',
    hobbies: ['Trekking','Reading','Tabla','Photography'],
    interests: ['Classical music','Travel','Food'],
    languagesSpoken: ['Punjabi','Hindi','English'],
    fitnessLevel: 'ACTIVE',
  },
  horoscope: {
    rashi: 'Tula', nakshatra: 'Chitra', dob: new Date('1998-08-14'),
    tob: '04:32', pob: 'New Delhi', manglik: false,
  },
  partnerPreferences: {
    ageRange: { min: 26, max: 34 }, heightRange: { min: 170, max: 195 },
    education: ['B.Tech','M.Tech','MBA','Masters','Bachelors'], religion: ['Hindu','Sikh'],
    manglik: 'ANY', diet: ['VEG','EGGETARIAN','NON_VEG'],
    incomeMin: 1500000, locations: ['Delhi','New Delhi','Mumbai','Bengaluru','Pune','Hyderabad','New York','London','Toronto'],
    openToInterCaste: true, openToInterfaith: true,
    maritalStatus: ['NEVER_MARRIED'],
    // Priya is the demo protagonist and the bypass is bilateral — with her
    // opted out, no cross-border candidate can surface no matter how the
    // candidates are configured, and a flag-on demo shows nothing.
    openToNriMatching: true,
  },
  safetyMode: { contactHidden: true, unlockedWith: [] },
  aboutMe: 'PM at Microsoft, daughter of a retired Army officer. Love trekking, classical tabla, and quiet evenings with a book. Looking for a partner who values family, conversations, and adventure equally.',
};

const ARJUN_PROFILE_CONTENT = {
  userId: ARJUN_USER_ID,
  personal: {
    fullName: 'Arjun Malhotra', dob: new Date('1995-11-22'), gender: 'MALE',
    height: 182, complexion: 'WHEATISH', maritalStatus: 'NEVER_MARRIED',
    motherTongue: 'Punjabi', religion: 'Hindu', caste: 'Khatri', subCaste: 'Punjabi Khatri',
    manglik: false, gotra: 'Vasishtha',
  },
  education: { degree: 'MBA', college: 'IIM Ahmedabad', fieldOfStudy: 'Finance', year: 2020 },
  profession: { occupation: 'VP Investment Banking', employer: 'Goldman Sachs', incomeRange: '60-80 LPA',
    workLocation: 'Delhi NCR', employerType: 'PRIVATE', designation: 'VP' },
  family: {
    fatherName: 'Sanjay Malhotra', fatherOccupation: 'Businessman (Real Estate)',
    motherName: 'Anjali Malhotra', motherOccupation: 'Homemaker',
    siblings: [{ name: 'Riya Malhotra', married: true, occupation: 'Lawyer' }],
    familyType: 'NUCLEAR', familyValues: 'TRADITIONAL_MODERATE', familyStatus: 'UPPER_MIDDLE',
    nativePlace: 'Delhi',
  },
  location: { city: 'New Delhi', state: 'Delhi', country: 'India' },
  lifestyle: {
    diet: 'VEG', smoking: 'NEVER', drinking: 'OCCASIONALLY',
    hobbies: ['Cricket','Investment podcasts','Travel','Cooking'],
    interests: ['Markets','Football','South-Asian cinema'],
    languagesSpoken: ['Punjabi','Hindi','English'],
    fitnessLevel: 'ACTIVE',
  },
  horoscope: {
    rashi: 'Mesha', nakshatra: 'Bharani', dob: new Date('1995-11-22'),
    tob: '09:15', pob: 'New Delhi', manglik: false,
  },
  partnerPreferences: {
    ageRange: { min: 25, max: 30 }, heightRange: { min: 158, max: 172 },
    education: ['B.Tech','MBA','Masters','Bachelors'], religion: ['Hindu'],
    manglik: 'ANY', diet: ['VEG','EGGETARIAN','NON_VEG'],
    locations: ['Delhi','Mumbai'],
    openToInterCaste: true, openToInterfaith: false,
    maritalStatus: ['NEVER_MARRIED'],
  },
  safetyMode: { contactHidden: false, unlockedWith: [PRIYA_USER_ID] },
  aboutMe: 'IB at Goldman, IIM-A grad. Love cricket, investing, and good food. Family-first, Delhi born and raised. Looking for someone thoughtful and ambitious who also values calm time with parents.',
};

// Display names for the ISO codes this seed uses. Presentation only — the
// authoritative value is the alpha-2 code on profiles.country_of_residence.
const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'USA', GB: 'United Kingdom', AE: 'United Arab Emirates', CA: 'Canada',
};

// DOBs computed so candidates land at the ages declared in CANDIDATES (year 2026 demo time).
const CANDIDATE_CONTENTS = CANDIDATES.map(c => {
  const birthYear = 2026 - c.age;
  const dob = new Date(`${birthYear}-06-15`);
  const height = 170 + (c.age % 6) + 5; // 175-188 range
  const incomeMid = c.income.includes('70-90') ? 8000000 :
                    c.income.includes('60-80') ? 7000000 :
                    c.income.includes('50-70') ? 6000000 :
                    c.income.includes('45-65') ? 5500000 :
                    c.income.includes('40-60') ? 5000000 :
                    c.income.includes('35-55') ? 4500000 :
                    c.income.includes('30-50') ? 4000000 :
                    c.income.includes('25-40') ? 3300000 :
                    c.income.includes('20-35') ? 2700000 :
                    c.income.includes('15-25') ? 2000000 : 3000000;
  return {
    userId: c.userId,
    personal: {
      fullName: c.name, gender: 'MALE', dob,
      height, maritalStatus: 'NEVER_MARRIED',
      motherTongue: c.community.split(' ')[0], religion: c.community.includes('Sikh') ? 'Sikh' : 'Hindu',
      caste: c.community, manglik: c.manglik,
    },
    education: { degree: c.community.includes('Brahmin') ? 'M.Tech' : 'B.Tech', college: 'Top Engineering College', year: birthYear + 22 },
    profession: { occupation: c.occupation, incomeRange: c.income, workLocation: c.city, employerType: 'PRIVATE',
      annualIncome: incomeMid },
    family: { familyType: 'NUCLEAR', familyValues: 'TRADITIONAL_MODERATE', familyStatus: 'UPPER_MIDDLE' },
    // Derived from the ISO code rather than a city name test — the old
    // `c.city === 'New York' ? 'USA' : 'India'` silently mislabelled every new
    // overseas row as India, which is exactly the kind of drift the NRI cohort
    // is meant to make visible.
    location: { city: c.city, state: c.state, country: COUNTRY_NAMES[c.country ?? 'IN'] ?? 'India' },
    lifestyle: { diet: 'VEG', smoking: 'NEVER', drinking: 'OCCASIONALLY',
      hobbies: ['Travel','Reading','Cricket'], languagesSpoken: [c.community.split(' ')[0],'Hindi','English'] },
    horoscope: { manglik: c.manglik, rashi: 'Various', nakshatra: 'Various', dob },
    partnerPreferences: {
      ageRange: { min: 24, max: 30 }, heightRange: { min: 155, max: 175 },
      education: ['B.Tech','MBA','Masters','Bachelors'], religion: ['Hindu'],
      manglik: 'ANY', diet: ['VEG','EGGETARIAN','NON_VEG'],
      incomeMin: 0, locations: ['Delhi','New Delhi','Mumbai','Bengaluru','Pune','Hyderabad'],
      openToInterCaste: true, openToInterfaith: true,
      maritalStatus: ['NEVER_MARRIED'],
      // Mongo-side mirror of profiles.open_to_nri_matching. The column is
      // authoritative (engine.ts reads it first); this is the legacy fallback
      // for rows written before the column existed, kept coherent so the two
      // sources can never disagree in the demo data.
      openToNriMatching: c.nriOptIn ?? false,
    },
    safetyMode: { contactHidden: true, unlockedWith: [] },
    aboutMe: `${c.occupation} based in ${c.city}. ${c.community} family. Looking for a thoughtful, family-oriented partner.`,
  };
});

const PRIYA_ARJUN_MATCH_ID = matchRequestId(1);

async function seedMongo() {
  console.info('🍃 seeding mongo (profile_contents + chats + portfolios)...');

  const allContents = [PRIYA_PROFILE_CONTENT, ARJUN_PROFILE_CONTENT, ...CANDIDATE_CONTENTS];

  // Always update mockStore.json so USE_MOCK_SERVICES=true sees the data
  const STORE_FILE = resolve(__dirname, '../../../apps/api/.data/mockStore.json');
  let existing: Record<string, Record<string, unknown>> = {};
  if (existsSync(STORE_FILE)) {
    try { existing = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as typeof existing; } catch { /* fresh */ }
  }
  for (const p of allContents) {
    existing[p.userId] = { ...(existing[p.userId] ?? {}), userId: p.userId, ...p };
  }
  mkdirSync(dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(existing, null, 2), 'utf8');
  console.info(`  ✅ mockStore.json: ${allContents.length} profile_contents`);

  if (!process.env['MONGODB_URI']) {
    console.warn('⚠️  MONGODB_URI not set — skipping live Mongo (mockStore.json populated)');
    return;
  }

  try {
    await mongoose.connect(process.env['MONGODB_URI'], { serverSelectionTimeoutMS: 3000 });

    for (const p of allContents) {
      await ProfileContentModel.findOneAndUpdate({ userId: p.userId }, p, { upsert: true, new: true });
    }
    console.info(`  ✅ Mongo profile_contents: ${allContents.length}`);

    // Chat: Priya × Arjun, 12 messages, 1 Hindi
    const day = (n: number) => new Date(Date.now() - n * 86400000);
    const hr = (h: number) => new Date(Date.now() - h * 3600000);
    const messages = [
      { senderId: PRIYA_USER_ID, content: 'Hi Arjun, thanks for accepting — your profile resonated with me.', sentAt: day(5),                 readAt: day(5),  type: 'TEXT' },
      { senderId: ARJUN_USER_ID, content: 'Hi Priya, thank you. Your profile reads thoughtful — I was glad to see it.', sentAt: day(5),         readAt: day(5),  type: 'TEXT' },
      { senderId: PRIYA_USER_ID, content: 'Tell me about your family — I saw your sister is married?', sentAt: day(4),                          readAt: day(4),  type: 'TEXT' },
      { senderId: ARJUN_USER_ID, content: 'Yes, Riya — she\'s a year older. Mum and Dad live with me in Delhi. Yours?', sentAt: day(4),           readAt: day(4),  type: 'TEXT' },
      { senderId: PRIYA_USER_ID, content: 'मेरी मम्मी कहती हैं कि आप बहुत अच्छे लगते हैं', contentHi: 'मेरी मम्मी कहती हैं कि आप बहुत अच्छे लगते हैं', sentAt: day(4), readAt: day(4), type: 'TEXT' },
      { senderId: ARJUN_USER_ID, content: 'Haha thank Aunty for me 🙏 — would love to meet them eventually.', sentAt: day(4),                     readAt: day(4),  type: 'TEXT' },
      { senderId: PRIYA_USER_ID, content: 'How are things at Goldman? IB hours can\'t be easy.', sentAt: day(3),                                  readAt: day(3),  type: 'TEXT' },
      { senderId: ARJUN_USER_ID, content: 'It\'s alright — busy but I make time for cricket on Sundays. You?', sentAt: day(3),                    readAt: day(3),  type: 'TEXT' },
      { senderId: PRIYA_USER_ID, content: 'Microsoft is good, mostly remote so I can do my tabla evenings. Want to meet for coffee?', sentAt: day(2), readAt: day(2),  type: 'TEXT' },
      { senderId: ARJUN_USER_ID, content: 'Yes please! Khan Market, Saturday 4pm?', sentAt: day(2),                                                readAt: day(2),  type: 'TEXT' },
      { senderId: PRIYA_USER_ID, content: 'Perfect. Also — would you like to schedule a video call before Saturday? Just to break the ice.', sentAt: day(1), readAt: day(1),  type: 'TEXT' },
      { senderId: ARJUN_USER_ID, content: 'Looking forward to tomorrow!', sentAt: hr(2),                                                                             type: 'TEXT' },
    ];

    await ChatModel.findOneAndUpdate(
      { matchId: PRIYA_ARJUN_MATCH_ID },
      { matchId: PRIYA_ARJUN_MATCH_ID, participants: [PRIYA_USER_ID, ARJUN_USER_ID], messages },
      { upsert: true, new: true },
    );
    console.info('  ✅ Mongo chat: 12 messages (1 Hindi)');

    // Vendor portfolios
    for (const v of VENDORS) {
      const slug = v.businessName.toLowerCase().replace(/[^a-z]+/g, '-');
      await PortfolioModel.findOneAndUpdate(
        { vendorId: v.id },
        {
          vendorId: v.id, about: v.description, tagline: v.tagline,
          portfolioItems: [
            { title: `${v.businessName} · Recent work 1`, imageUrl: `https://picsum.photos/seed/${slug}-1/800/600`, caption: 'Featured ceremony coverage' },
            { title: `${v.businessName} · Recent work 2`, imageUrl: `https://picsum.photos/seed/${slug}-2/800/600`, caption: 'Editorial highlights' },
            { title: `${v.businessName} · Recent work 3`, imageUrl: `https://picsum.photos/seed/${slug}-3/800/600`, caption: 'Featured detail shots' },
            { title: `${v.businessName} · Recent work 4`, imageUrl: `https://picsum.photos/seed/${slug}-4/800/600`, caption: 'Behind the scenes' },
          ],
          reviews: [
            { author: 'Arjun & Priya, Delhi', rating: 5, text: 'Outstanding service, on time, on budget. Couldn\'t recommend more.', date: new Date('2025-12-15') },
            { author: 'Aanya & Rohit, Pune',  rating: 5, text: 'Truly professional team — they understood our brief.', date: new Date('2025-09-20') },
            { author: 'Karan & Mehak, Mumbai', rating: 4, text: 'Lovely work; one minor scheduling hiccup but addressed quickly.', date: new Date('2025-06-08') },
          ],
        },
        { upsert: true, new: true },
      );
    }
    console.info('  ✅ Mongo vendor_portfolios: 6');

    await mongoose.disconnect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`⚠️  Mongo seed skipped (${msg}). mockStore.json still populated.`);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
export async function seedFullDemo(): Promise<void> {
  console.info('🌱 Smart Shaadi — Full Demo Seed');
  await seedPlans();
  await wipeDemo();
  await seedUsers();
  await seedVendors();
  await seedMatches();
  await seedWedding();
  await seedGuests();
  await seedNotifications();
  await seedMongo();
  // Phase 8 supply. Runs AFTER wipeDemo + seedVendors on purpose: wipeDemo
  // truncates `vendors CASCADE`, which reaches premium_packages through its FK,
  // and deletes every `seed-%` user — including the venue owner accounts these
  // seeds create.
  console.info('🏛  seeding Phase 8 supply (8.1 packages + 8.2 services)...');
  await seedPremiumPackages();
  await seedPostMarriage();
  console.info('✅ Demo seed complete.');
  await pool.end();
}

// Allow running this file directly: `tsx packages/db/seed/full-demo.ts`
if (require.main === module) {
  seedFullDemo().catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); });
}
