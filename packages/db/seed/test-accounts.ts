/**
 * QA / Test-Account Seed — Tier 1 (pre-launch QA)
 * ================================================
 * Seeds realistic, Indian-style accounts across ALL six roles so QA can exercise:
 *   - onboarding UI (profiles staged at 0/20/40/60/80/100 % completion)
 *   - reciprocal matching (opposite-gender clusters by religion/region that self-match)
 *   - vendor dynamic-pricing (pricing_rules that exercise the engine's clamp bounds)
 *   - the KYC manual-approval admin queue (profiles parked in MANUAL_REVIEW / INFO_REQUESTED)
 *   - FAMILY_MEMBER permission boundaries + EVENT_COORDINATOR dashboards
 *
 * ISOLATION — every row is tagged and bulk-removable, fully separate from full-demo:
 *   user.id   LIKE 'qa-%'                (full-demo uses 'seed-%')
 *   phone     +9170000000xx             (full-demo uses +918888880xxx)
 *   email     <id>@qa.smartshaadi.test  (full-demo uses @test.smartshaadi.co.in)
 *   UUIDs     '0ada....' namespace       (full-demo uses 1111…/2222…)
 *
 * Idempotent: every insert uses a deterministic id + .onConflictDoNothing(); Mongo/mockStore
 * content is upsert-merged by userId. Re-running never duplicates.
 *
 * Demographic content lives in MongoDB `profiles_content` (keyed by userId), mirrored to
 * apps/api/.data/mockStore.json for USE_MOCK_SERVICES mode. We write BOTH.
 *
 * Run (LOCAL ONLY — needs DATABASE_URL + optionally MONGODB_URI; root .env loaded):
 *   pnpm --filter @smartshaadi/db db:seed:test-accounts            # seed
 *   pnpm --filter @smartshaadi/db db:seed:test-accounts:remove     # teardown (deletes all qa-%)
 *
 * After seeding, a gitignored credentials sheet is written to seed/qa-credentials.local.md.
 * Testers log in with phone + OTP = MOCK_OTP_VALUE (from root .env).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import mongoose, { Schema } from 'mongoose';
import {
  user, profiles, profilePhotos, communityZones, profileSections, kycVerifications,
  vendors, vendorServices, vendorCapacity, pricingRules,
  parentChildLinks, familyMembers, weddings, weddingCoordinatorAssignments,
} from '../schema/index.js';

// CommonJS package (no "type": "module") — tsx runs this as CJS, so __dirname is the Node global.
config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

const REMOVE = process.argv.includes('--remove');

// ── Tag / convention constants (tunable) ──────────────────────────────────────
const COUNTS = { INDIVIDUAL: 22, FAMILY_MEMBER: 6, VENDOR: 9, EVENT_COORDINATOR: 3, ADMIN: 2, SUPPORT: 2 };
const PHONE_BASE = 7000000000;          // +91 70000000xx — all distinct from full-demo's 8888880xxx
const EMAIL_DOMAIN = 'qa.smartshaadi.test';
const MOCK_AADHAAR = '1234-5678-9012';  // ONLY allowed mock Aadhaar (CLAUDE.md)
const REF_YEAR = 2026;                  // ages are computed relative to this demo year
const QA_WEDDING_ID = '0ada0009-0000-4000-8000-000000000001';

const phone = (offset: number): string => `+91${PHONE_BASE + offset}`;
const email = (userId: string): string => `${userId}@${EMAIL_DOMAIN}`;
const pad = (n: number): string => n.toString().padStart(12, '0');
// Deterministic UUIDs, one byte-prefix per table (all valid hex, distinct from full-demo)
const indProfileId = (n: number): string => `0ada0001-0000-4000-8000-${pad(n)}`;
const venProfileId = (n: number): string => `0ada0002-0000-4000-8000-${pad(n)}`;
const pricingRuleId = (n: number): string => `0ada0003-0000-4000-8000-${pad(n)}`;
const capacityId = (n: number): string => `0ada0004-0000-4000-8000-${pad(n)}`;
const serviceId = (n: number): string => `0ada0005-0000-4000-8000-${pad(n)}`;
const vendorRowId = (n: number): string => `0ada0006-0000-4000-8000-${pad(n)}`;
const photoId = (n: number): string => `0ada0007-0000-4000-8000-${pad(n)}`;
const kycId = (n: number): string => `0ada0008-0000-4000-8000-${pad(n)}`;
const familyMemberId = (n: number): string => `0ada000a-0000-4000-8000-${pad(n)}`;
const coordAssignId = (n: number): string => `0ada000b-0000-4000-8000-${pad(n)}`;

const now = (): Date => new Date();

// ── Types ─────────────────────────────────────────────────────────────────────
type Gender = 'MALE' | 'FEMALE';
type Diet = 'VEG' | 'NON_VEG' | 'JAIN' | 'VEGAN' | 'EGGETARIAN';
type VerStatus = 'VERIFIED' | 'MANUAL_REVIEW' | 'INFO_REQUESTED';
type ContentLevel = 'none' | 'min' | 'p40' | 'p60' | 'p80' | 'full';
type Section = 'personal' | 'family' | 'career' | 'lifestyle' | 'horoscope' | 'photos' | 'preferences' | 'personality';

interface QaIndividual {
  userId: string;
  name: string;
  gender: Gender;
  age: number;
  city: string;
  state: string;
  country?: string;
  religion: string;
  community: string;
  subCommunity?: string;
  caste?: string;
  gotra?: string;
  motherTongue: string;
  degree: string;
  occupation: string;
  employer?: string;
  incomeRange: string;
  diet: Diet;
  manglik: boolean;
  nri?: boolean;
  cluster: string;          // grouping label for credentials + pairing intuition
  completeness: number;     // 0-100, written directly to profiles.profileCompleteness
  isActive: boolean;        // feed visibility gate (must be true to surface to others)
  verificationStatus: VerStatus;
  contentLevel: ContentLevel;
  sections: Section[];      // profileSections booleans set true
}

interface QaVendor {
  userId: string;
  businessName: string;
  category: 'VENUE' | 'CATERING' | 'PHOTOGRAPHY' | 'VIDEOGRAPHY' | 'DECORATION' | 'MAKEUP' | 'MUSIC' | 'LIGHTING' | 'PRIEST';
  city: string;
  state: string;
  basePaise: bigint;
  floor: number;
  ceiling: number;
  muhurat: number;
  offSeason: number;
  serviceName: string;
  priceUnit: 'PER_EVENT' | 'PER_HOUR' | 'PER_PERSON';
}

interface QaParentLink {
  parentUserId: string;
  parentName: string;
  childUserId: string;
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SIBLING';
  permissions: 'VIEW_ONLY' | 'EDIT_PROFILE' | 'DRAFT_ACTIONS' | 'FULL_PROXY';
  consent: 'PENDING' | 'APPROVED' | 'REVOKED';
}

// ── Data: INDIVIDUALS (22) ────────────────────────────────────────────────────
// 14 matchable (opposite-gender clusters by religion/region) + 6 onboarding-staging + 2 KYC-queue.
const ALL_SECTIONS: Section[] = ['personal', 'family', 'career', 'lifestyle', 'horoscope', 'photos', 'preferences', 'personality'];

const MATCHABLE: Omit<QaIndividual, 'completeness' | 'isActive' | 'verificationStatus' | 'contentLevel' | 'sections'>[] = [
  // Cluster A — Maharashtra Hindu (Pune/Mumbai) — 2M / 2F, dense feed
  { userId: 'qa-ind-01', name: 'Aditya Deshmukh', gender: 'MALE',   age: 29, city: 'Pune',   state: 'Maharashtra', religion: 'Hindu', community: 'Maratha',  subCommunity: '96 Kuli Maratha', caste: 'Maratha', gotra: 'Shendge',   motherTongue: 'Marathi', degree: 'B.E.',   occupation: 'Software Engineer', employer: 'Persistent', incomeRange: '15-25 LPA', diet: 'NON_VEG', manglik: false, cluster: 'A · Maharashtra Hindu' },
  { userId: 'qa-ind-02', name: 'Rohan Joshi',     gender: 'MALE',   age: 30, city: 'Pune',   state: 'Maharashtra', religion: 'Hindu', community: 'Brahmin',  subCommunity: 'Deshastha Brahmin', caste: 'Brahmin', gotra: 'Bharadwaj', motherTongue: 'Marathi', degree: 'MBA',    occupation: 'Product Manager',  employer: 'Zensar',     incomeRange: '25-40 LPA', diet: 'VEG',     manglik: false, cluster: 'A · Maharashtra Hindu' },
  { userId: 'qa-ind-03', name: 'Sneha Kulkarni',  gender: 'FEMALE', age: 27, city: 'Pune',   state: 'Maharashtra', religion: 'Hindu', community: 'Brahmin',  subCommunity: 'Kokanastha Brahmin', caste: 'Brahmin', gotra: 'Kashyap',   motherTongue: 'Marathi', degree: 'M.Tech', occupation: 'Data Scientist',   employer: 'TCS',        incomeRange: '15-25 LPA', diet: 'VEG',     manglik: false, cluster: 'A · Maharashtra Hindu' },
  { userId: 'qa-ind-04', name: 'Priyanka Patil',  gender: 'FEMALE', age: 28, city: 'Mumbai', state: 'Maharashtra', religion: 'Hindu', community: 'Maratha',  subCommunity: 'Maratha', caste: 'Maratha', gotra: 'Jadhav',    motherTongue: 'Marathi', degree: 'B.Com',  occupation: 'Chartered Accountant', employer: 'Deloitte', incomeRange: '15-25 LPA', diet: 'NON_VEG', manglik: true,  cluster: 'A · Maharashtra Hindu' },
  // Cluster B — Punjab Sikh
  { userId: 'qa-ind-05', name: 'Gurpreet Singh',  gender: 'MALE',   age: 30, city: 'Chandigarh', state: 'Punjab',  religion: 'Sikh',  community: 'Jat Sikh', subCommunity: 'Jat Sikh', caste: 'Jat',     gotra: 'Sidhu',     motherTongue: 'Punjabi', degree: 'B.Tech', occupation: 'Civil Engineer',   employer: 'L&T',        incomeRange: '15-25 LPA', diet: 'NON_VEG', manglik: false, cluster: 'B · Punjab Sikh' },
  { userId: 'qa-ind-06', name: 'Simran Kaur',     gender: 'FEMALE', age: 28, city: 'Amritsar',   state: 'Punjab',  religion: 'Sikh',  community: 'Jat Sikh', subCommunity: 'Jat Sikh', caste: 'Jat',     gotra: 'Gill',      motherTongue: 'Punjabi', degree: 'MBBS',   occupation: 'Doctor',           employer: 'Fortis',     incomeRange: '15-25 LPA', diet: 'VEG',     manglik: false, cluster: 'B · Punjab Sikh' },
  // Cluster C — Tamil Nadu Hindu
  { userId: 'qa-ind-07', name: 'Karthik Iyer',    gender: 'MALE',   age: 29, city: 'Chennai',  state: 'Tamil Nadu', religion: 'Hindu', community: 'Iyer',    subCommunity: 'Vadama Iyer', caste: 'Brahmin', gotra: 'Atreya',    motherTongue: 'Tamil',   degree: 'M.S.',   occupation: 'Research Engineer', employer: 'Qualcomm',   incomeRange: '25-40 LPA', diet: 'VEG',     manglik: false, cluster: 'C · Tamil Nadu Hindu' },
  { userId: 'qa-ind-08', name: 'Divya Subramanian', gender: 'FEMALE', age: 27, city: 'Chennai', state: 'Tamil Nadu', religion: 'Hindu', community: 'Iyengar', subCommunity: 'Vadakalai Iyengar', caste: 'Brahmin', gotra: 'Srivatsa', motherTongue: 'Tamil', degree: 'B.Tech', occupation: 'UX Designer',      employer: 'Zoho',       incomeRange: '10-15 LPA', diet: 'VEG',     manglik: false, cluster: 'C · Tamil Nadu Hindu' },
  // Cluster D — North Indian Muslim
  { userId: 'qa-ind-09', name: 'Imran Sheikh',    gender: 'MALE',   age: 31, city: 'Lucknow', state: 'Uttar Pradesh', religion: 'Muslim', community: 'Sunni', subCommunity: 'Sheikh', caste: 'Sheikh', motherTongue: 'Urdu', degree: 'B.Tech', occupation: 'Architect',        employer: 'Self-employed', incomeRange: '15-25 LPA', diet: 'NON_VEG', manglik: false, cluster: 'D · North Indian Muslim' },
  { userId: 'qa-ind-10', name: 'Ayesha Khan',     gender: 'FEMALE', age: 28, city: 'Delhi',   state: 'Delhi',         religion: 'Muslim', community: 'Sunni', subCommunity: 'Pathan', caste: 'Pathan', motherTongue: 'Urdu', degree: 'M.A.',   occupation: 'School Teacher',   employer: 'DPS',        incomeRange: '5-10 LPA',  diet: 'NON_VEG', manglik: false, cluster: 'D · North Indian Muslim' },
  // Cluster E — Gujarat Jain
  { userId: 'qa-ind-11', name: 'Rahul Shah',      gender: 'MALE',   age: 32, city: 'Ahmedabad', state: 'Gujarat', religion: 'Jain', community: 'Shwetambar', subCommunity: 'Shwetambar', caste: 'Vania', motherTongue: 'Gujarati', degree: 'CA',    occupation: 'Finance Director', employer: 'Adani',      incomeRange: '40-60 LPA', diet: 'JAIN',    manglik: false, cluster: 'E · Gujarat Jain' },
  { userId: 'qa-ind-12', name: 'Khushboo Mehta',  gender: 'FEMALE', age: 29, city: 'Ahmedabad', state: 'Gujarat', religion: 'Jain', community: 'Shwetambar', subCommunity: 'Shwetambar', caste: 'Vania', motherTongue: 'Gujarati', degree: 'M.Com', occupation: 'Investment Analyst', employer: 'HDFC',      incomeRange: '15-25 LPA', diet: 'JAIN',    manglik: false, cluster: 'E · Gujarat Jain' },
  // Cluster F — NRI Hindu (working abroad)
  { userId: 'qa-ind-13', name: 'Vikram Reddy',    gender: 'MALE',   age: 33, city: 'San Jose', state: 'California', country: 'USA', religion: 'Hindu', community: 'Reddy', subCommunity: 'Reddy', caste: 'Reddy', motherTongue: 'Telugu', degree: 'M.S.', occupation: 'Staff Engineer', employer: 'Google', incomeRange: '60-80 LPA', diet: 'NON_VEG', manglik: false, nri: true, cluster: 'F · NRI Hindu' },
  { userId: 'qa-ind-14', name: 'Ananya Nair',     gender: 'FEMALE', age: 30, city: 'London',   state: 'England',    country: 'UK',  religion: 'Hindu', community: 'Nair',  subCommunity: 'Nair', caste: 'Nair', motherTongue: 'Malayalam', degree: 'MBA', occupation: 'Management Consultant', employer: 'McKinsey', incomeRange: '60-80 LPA', diet: 'VEG', manglik: false, nri: true, cluster: 'F · NRI Hindu' },
];

const STAGING: (Omit<QaIndividual, 'sections'> & { sections: Section[] })[] = [
  { userId: 'qa-ind-15', name: 'Megha Rao',     gender: 'FEMALE', age: 26, city: 'Bengaluru', state: 'Karnataka',    religion: 'Hindu', community: 'Gowda',   motherTongue: 'Kannada', degree: 'B.E.',  occupation: 'QA Engineer',       incomeRange: '10-15 LPA', diet: 'VEG',     manglik: false, cluster: 'Onboarding 0%',   completeness: 0,   isActive: false, verificationStatus: 'VERIFIED', contentLevel: 'none', sections: [] },
  { userId: 'qa-ind-16', name: 'Arnav Das',     gender: 'MALE',   age: 28, city: 'Kolkata',   state: 'West Bengal',  religion: 'Hindu', community: 'Kayastha', motherTongue: 'Bengali', degree: 'B.Sc.', occupation: 'Banker',           incomeRange: '10-15 LPA', diet: 'NON_VEG', manglik: false, cluster: 'Onboarding 20%',  completeness: 20,  isActive: false, verificationStatus: 'VERIFIED', contentLevel: 'min',  sections: ['personal'] },
  { userId: 'qa-ind-17', name: 'Pooja Sharma',  gender: 'FEMALE', age: 27, city: 'Jaipur',    state: 'Rajasthan',    religion: 'Hindu', community: 'Agarwal',  motherTongue: 'Hindi',   degree: 'B.A.',  occupation: 'HR Executive',      incomeRange: '5-10 LPA',  diet: 'VEG',     manglik: false, cluster: 'Onboarding 40%',  completeness: 40,  isActive: false, verificationStatus: 'VERIFIED', contentLevel: 'p40',  sections: ['personal', 'career', 'lifestyle'] },
  { userId: 'qa-ind-18', name: 'Thomas Mathew', gender: 'MALE',   age: 30, city: 'Kochi',     state: 'Kerala',       religion: 'Christian', community: 'Syrian Christian', motherTongue: 'Malayalam', degree: 'B.Tech', occupation: 'Marine Engineer', incomeRange: '15-25 LPA', diet: 'NON_VEG', manglik: false, cluster: 'Onboarding 60%',  completeness: 60,  isActive: false, verificationStatus: 'VERIFIED', contentLevel: 'p60', sections: ['personal', 'photos', 'career', 'lifestyle'] },
  { userId: 'qa-ind-19', name: 'Neha Verma',    gender: 'FEMALE', age: 29, city: 'Indore',    state: 'Madhya Pradesh', religion: 'Hindu', community: 'Rajput', motherTongue: 'Hindi', degree: 'M.B.A.', occupation: 'Brand Manager',     incomeRange: '15-25 LPA', diet: 'VEG',     manglik: true,  cluster: 'Onboarding 80%',  completeness: 80,  isActive: false, verificationStatus: 'VERIFIED', contentLevel: 'p80', sections: ['personal', 'photos', 'career', 'lifestyle', 'family', 'horoscope'] },
  { userId: 'qa-ind-20', name: 'Sandeep Yadav', gender: 'MALE',   age: 31, city: 'Patna',     state: 'Bihar',        religion: 'Hindu', community: 'Yadav',   motherTongue: 'Hindi',   degree: 'B.Tech', occupation: 'Govt Officer (IES)', incomeRange: '15-25 LPA', diet: 'VEG',    manglik: false, cluster: 'Onboarding 100%', completeness: 100, isActive: true,  verificationStatus: 'VERIFIED', contentLevel: 'full', sections: ALL_SECTIONS },
];

const KYC_QUEUE: (Omit<QaIndividual, 'sections'> & { sections: Section[] })[] = [
  { userId: 'qa-ind-21', name: 'Manish Gupta', gender: 'MALE', age: 30, city: 'Noida',     state: 'Uttar Pradesh', religion: 'Hindu',  community: 'Vaishya', motherTongue: 'Hindi', degree: 'B.Com', occupation: 'Entrepreneur', incomeRange: '25-40 LPA', diet: 'VEG',     manglik: false, cluster: 'KYC · MANUAL_REVIEW',  completeness: 60, isActive: false, verificationStatus: 'MANUAL_REVIEW',  contentLevel: 'p60', sections: ['personal', 'career', 'lifestyle'] },
  { userId: 'qa-ind-22', name: 'Farhan Ali',   gender: 'MALE', age: 29, city: 'Hyderabad', state: 'Telangana',     religion: 'Muslim', community: 'Sunni',   motherTongue: 'Urdu',  degree: 'B.Tech', occupation: 'DevOps Engineer', incomeRange: '15-25 LPA', diet: 'NON_VEG', manglik: false, cluster: 'KYC · INFO_REQUESTED', completeness: 40, isActive: false, verificationStatus: 'INFO_REQUESTED', contentLevel: 'p40', sections: ['personal', 'career'] },
];

const INDIVIDUALS: QaIndividual[] = [
  ...MATCHABLE.map((m): QaIndividual => ({
    ...m,
    completeness: 100,
    isActive: true,
    verificationStatus: 'VERIFIED',
    contentLevel: 'full',
    sections: ALL_SECTIONS,
  })),
  ...STAGING,
  ...KYC_QUEUE,
];

// ── Data: VENDORS (9) ─────────────────────────────────────────────────────────
const VENDORS: QaVendor[] = [
  { userId: 'qa-ven-01', businessName: 'Royal Garden Banquets',     category: 'VENUE',       city: 'Jaipur',     state: 'Rajasthan',  basePaise: 50000000n, floor: 0.7,  ceiling: 2.2, muhurat: 1.25, offSeason: 0.85, serviceName: 'Full-day banquet hire',     priceUnit: 'PER_EVENT' },
  { userId: 'qa-ven-02', businessName: 'Spice Route Caterers',      category: 'CATERING',    city: 'Mumbai',     state: 'Maharashtra', basePaise: 12000000n, floor: 0.8,  ceiling: 1.8, muhurat: 1.20, offSeason: 0.90, serviceName: 'Wedding catering (250 pax)', priceUnit: 'PER_EVENT' },
  { userId: 'qa-ven-03', businessName: 'Lens & Light Studio',       category: 'PHOTOGRAPHY', city: 'Delhi',      state: 'Delhi',      basePaise: 7500000n,  floor: 0.7,  ceiling: 2.5, muhurat: 1.30, offSeason: 0.85, serviceName: 'Candid wedding photography', priceUnit: 'PER_EVENT' },
  { userId: 'qa-ven-04', businessName: 'Cinematic Vows Films',      category: 'VIDEOGRAPHY', city: 'Bengaluru',  state: 'Karnataka',  basePaise: 9000000n,  floor: 0.75, ceiling: 2.0, muhurat: 1.25, offSeason: 0.90, serviceName: 'Wedding film + teaser',      priceUnit: 'PER_EVENT' },
  { userId: 'qa-ven-05', businessName: 'Marigold Decor Co',         category: 'DECORATION',  city: 'Pune',       state: 'Maharashtra', basePaise: 6000000n,  floor: 0.7,  ceiling: 2.2, muhurat: 1.20, offSeason: 0.85, serviceName: 'Mandap + mehendi decor',     priceUnit: 'PER_EVENT' },
  { userId: 'qa-ven-06', businessName: 'Glamour Bridal Makeup',     category: 'MAKEUP',      city: 'Chandigarh', state: 'Punjab',     basePaise: 4000000n,  floor: 0.8,  ceiling: 1.9, muhurat: 1.15, offSeason: 0.95, serviceName: 'Bridal HD makeup',           priceUnit: 'PER_EVENT' },
  { userId: 'qa-ven-07', businessName: 'Dhol Beats Live',           category: 'MUSIC',       city: 'Amritsar',   state: 'Punjab',     basePaise: 5500000n,  floor: 0.7,  ceiling: 2.0, muhurat: 1.20, offSeason: 0.90, serviceName: 'Live dhol + DJ',             priceUnit: 'PER_EVENT' },
  // Deliberately tight ceiling so the muhurat premium hits the clamp (clamp_hit=true) — exercises bound logic.
  { userId: 'qa-ven-08', businessName: 'Luminous Events Lighting',  category: 'LIGHTING',    city: 'Hyderabad',  state: 'Telangana',  basePaise: 3500000n,  floor: 0.7,  ceiling: 1.1, muhurat: 1.25, offSeason: 1.00, serviceName: 'Stage + ambient lighting',   priceUnit: 'PER_EVENT' },
  { userId: 'qa-ven-09', businessName: 'Vedic Rituals Pandit Ji',   category: 'PRIEST',      city: 'Varanasi',   state: 'Uttar Pradesh', basePaise: 2100000n, floor: 0.9, ceiling: 1.5, muhurat: 1.30, offSeason: 1.00, serviceName: 'Vedic wedding ceremony',    priceUnit: 'PER_EVENT' },
];

// ── Data: FAMILY_MEMBER (6) — parent-child permission boundaries ───────────────
const PARENT_LINKS: QaParentLink[] = [
  { parentUserId: 'qa-fam-01', parentName: 'Lakshmi Deshmukh', childUserId: 'qa-ind-01', relationship: 'MOTHER', permissions: 'VIEW_ONLY',     consent: 'APPROVED' },  // 1:1 happy path
  { parentUserId: 'qa-fam-02', parentName: 'Rajesh Kulkarni',  childUserId: 'qa-ind-03', relationship: 'FATHER', permissions: 'EDIT_PROFILE',  consent: 'APPROVED' },  // 1:many (a)
  { parentUserId: 'qa-fam-02', parentName: 'Rajesh Kulkarni',  childUserId: 'qa-ind-04', relationship: 'FATHER', permissions: 'EDIT_PROFILE',  consent: 'APPROVED' },  // 1:many (b)
  { parentUserId: 'qa-fam-03', parentName: 'Harpreet Singh',   childUserId: 'qa-ind-05', relationship: 'FATHER', permissions: 'FULL_PROXY',    consent: 'APPROVED' },  // proxy actions
  { parentUserId: 'qa-fam-04', parentName: 'Fatima Khan',      childUserId: 'qa-ind-10', relationship: 'MOTHER', permissions: 'EDIT_PROFILE',  consent: 'PENDING'  },  // consent not given → blocked
  { parentUserId: 'qa-fam-05', parentName: 'Suresh Iyer',      childUserId: 'qa-ind-07', relationship: 'FATHER', permissions: 'VIEW_ONLY',     consent: 'REVOKED' },   // revoked → blocked
];
// qa-fam-06 is a standalone collaborator (roster row, no parent_child_link) on qa-ind-11's profile.
const STANDALONE_FAMILY = { userId: 'qa-fam-06', name: 'Meena Shah', childUserId: 'qa-ind-11', relationship: 'MOTHER' as const };

const FAMILY_USERS: { userId: string; name: string }[] = [
  { userId: 'qa-fam-01', name: 'Lakshmi Deshmukh' },
  { userId: 'qa-fam-02', name: 'Rajesh Kulkarni' },
  { userId: 'qa-fam-03', name: 'Harpreet Singh' },
  { userId: 'qa-fam-04', name: 'Fatima Khan' },
  { userId: 'qa-fam-05', name: 'Suresh Iyer' },
  { userId: 'qa-fam-06', name: 'Meena Shah' },
];

// ── Data: EVENT_COORDINATOR (3) / ADMIN (2) / SUPPORT (2) ──────────────────────
const COORDINATORS: { userId: string; name: string; assigned: boolean; scope: 'VIEW' | 'EDIT' | 'DAY_OF' | 'FULL' }[] = [
  { userId: 'qa-coord-01', name: 'Anil Coordinator', assigned: true,  scope: 'FULL' },
  { userId: 'qa-coord-02', name: 'Sunita Planner',   assigned: true,  scope: 'DAY_OF' },
  { userId: 'qa-coord-03', name: 'Ramesh Events',    assigned: false, scope: 'FULL' },  // unassigned → empty-dashboard test
];
const ADMINS = [{ userId: 'qa-admin-01', name: 'QA Admin One' }, { userId: 'qa-admin-02', name: 'QA Admin Two' }];
const SUPPORTS = [{ userId: 'qa-support-01', name: 'QA Support One' }, { userId: 'qa-support-02', name: 'QA Support Two' }];

// Phone-offset registry (keeps every phone unique + decodable)
const phoneOffset = (userId: string): number => {
  const m = /qa-([a-z]+)-(\d+)/.exec(userId);
  if (!m) return 999;
  const kind = m[1] ?? '';
  const n = Number(m[2] ?? '0');
  const bases: Record<string, number> = { ind: 0, ven: 200, fam: 100, coord: 300, admin: 400, support: 500 };
  return (bases[kind] ?? 600) + n;
};

// ── Mongo content builder (depth scaled by contentLevel) ───────────────────────
function makeContent(ind: QaIndividual): Record<string, unknown> | null {
  if (ind.contentLevel === 'none') return null;
  const dob = new Date(`${REF_YEAR - ind.age}-06-15`);
  const prefReligions = [ind.religion];
  const prefLocations = [ind.city, ind.state, 'India'];
  const doc: Record<string, unknown> = {
    userId: ind.userId,
    personal: {
      fullName: ind.name, dob, gender: ind.gender,
      height: ind.gender === 'MALE' ? 178 : 162, complexion: 'WHEATISH',
      maritalStatus: 'NEVER_MARRIED', motherTongue: ind.motherTongue,
      religion: ind.religion, caste: ind.caste, subCaste: ind.subCommunity,
      manglik: ind.manglik, gotra: ind.gotra,
    },
    aboutMe: `${ind.occupation} based in ${ind.city}. ${ind.community} family. Looking for a thoughtful, family-oriented partner.`,
    safetyMode: { contactHidden: true, unlockedWith: [] },
  };
  if (ind.contentLevel === 'min') return doc;

  doc['profession'] = {
    occupation: ind.occupation, employer: ind.employer ?? 'Confidential', incomeRange: ind.incomeRange,
    workLocation: ind.nri ? `${ind.city}, ${ind.country}` : `${ind.city}, ${ind.state}`,
    employerType: 'PRIVATE', designation: ind.occupation,
    workingAbroad: Boolean(ind.nri), abroadCountry: ind.nri ? ind.country : undefined,
  };
  doc['education'] = { degree: ind.degree, college: '', fieldOfStudy: '', year: REF_YEAR - ind.age + 22 };
  doc['location'] = { city: ind.city, state: ind.state, country: ind.country ?? 'India' };
  if (ind.contentLevel === 'p40') return doc;

  doc['lifestyle'] = {
    diet: ind.diet, smoking: 'NEVER', drinking: 'OCCASIONALLY',
    hobbies: ['Reading', 'Travel', 'Music'], interests: ['Food', 'Cinema'],
    languagesSpoken: [ind.motherTongue, 'Hindi', 'English'], fitnessLevel: 'ACTIVE',
  };
  if (ind.contentLevel === 'p60') return doc;

  doc['family'] = {
    fatherName: 'Confidential', fatherOccupation: 'Business',
    motherName: 'Confidential', motherOccupation: 'Homemaker',
    siblings: [], familyType: 'NUCLEAR', familyValues: 'TRADITIONAL_MODERATE',
    familyStatus: 'UPPER_MIDDLE', nativePlace: `${ind.city}, ${ind.state}`,
  };
  doc['horoscope'] = { rashi: 'Tula', nakshatra: 'Chitra', dob, tob: '06:00', pob: ind.city, manglik: ind.manglik };
  if (ind.contentLevel === 'p80') return doc;

  // full
  doc['partnerPreferences'] = {
    ageRange: { min: 24, max: 40 }, heightRange: { min: 150, max: 200 },
    education: [ind.degree, 'Bachelors', 'Masters', 'MBA', 'B.Tech'],
    religion: prefReligions, manglik: 'ANY', diet: ['VEG', 'EGGETARIAN', 'NON_VEG', 'JAIN'],
    incomeMin: 300000, locations: prefLocations,
    openToInterCaste: true, openToInterfaith: false,
    maritalStatus: ['NEVER_MARRIED'], partnerGender: [ind.gender === 'MALE' ? 'FEMALE' : 'MALE'],
  };
  return doc;
}

// ── Mongoose models (local, mirror full-demo) ─────────────────────────────────
const profileContentSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  personal: Schema.Types.Mixed, education: Schema.Types.Mixed, profession: Schema.Types.Mixed,
  family: Schema.Types.Mixed, location: Schema.Types.Mixed, lifestyle: Schema.Types.Mixed,
  horoscope: Schema.Types.Mixed, partnerPreferences: Schema.Types.Mixed,
  safetyMode: Schema.Types.Mixed, aboutMe: String,
}, { collection: 'profiles_content', timestamps: true });
const ProfileContentModel: mongoose.Model<Record<string, unknown>> =
  (mongoose.models['ProfileContent'] as mongoose.Model<Record<string, unknown>> | undefined)
  ?? mongoose.model<Record<string, unknown>>('ProfileContent', profileContentSchema);

const STORE_FILE = resolve(__dirname, '../../../apps/api/.data/mockStore.json');

// ── SEED ──────────────────────────────────────────────────────────────────────
async function seedUsers(): Promise<void> {
  console.info('👤 users + profiles...');
  const userRows: { id: string; name: string; email: string; phoneNumber: string; role: string }[] = [];
  for (const i of INDIVIDUALS) userRows.push({ id: i.userId, name: i.name, email: email(i.userId), phoneNumber: phone(phoneOffset(i.userId)), role: 'INDIVIDUAL' });
  for (const v of VENDORS) userRows.push({ id: v.userId, name: v.businessName, email: email(v.userId), phoneNumber: phone(phoneOffset(v.userId)), role: 'VENDOR' });
  for (const f of FAMILY_USERS) userRows.push({ id: f.userId, name: f.name, email: email(f.userId), phoneNumber: phone(phoneOffset(f.userId)), role: 'FAMILY_MEMBER' });
  for (const c of COORDINATORS) userRows.push({ id: c.userId, name: c.name, email: email(c.userId), phoneNumber: phone(phoneOffset(c.userId)), role: 'EVENT_COORDINATOR' });
  for (const a of ADMINS) userRows.push({ id: a.userId, name: a.name, email: email(a.userId), phoneNumber: phone(phoneOffset(a.userId)), role: 'ADMIN' });
  for (const s of SUPPORTS) userRows.push({ id: s.userId, name: s.name, email: email(s.userId), phoneNumber: phone(phoneOffset(s.userId)), role: 'SUPPORT' });

  for (const u of userRows) {
    await db.insert(user).values({
      id: u.id, name: u.name, email: u.email, emailVerified: true,
      phoneNumber: u.phoneNumber, phoneNumberVerified: true,
      role: u.role, status: 'ACTIVE', createdAt: now(), updatedAt: now(),
    }).onConflictDoNothing();
  }
  console.info(`  ✅ ${userRows.length} users`);

  // INDIVIDUAL profiles (+ communityZones + profileSections + photos + kyc)
  let photoCounter = 0, kycCounter = 0;
  for (const [idx, i] of INDIVIDUALS.entries()) {
    const pid = indProfileId(idx + 1);
    await db.insert(profiles).values({
      id: pid, userId: i.userId,
      verificationStatus: i.verificationStatus, premiumTier: 'FREE',
      profileCompleteness: i.completeness, isActive: i.isActive,
      lastActiveAt: now(), createdAt: now(), updatedAt: now(),
    }).onConflictDoNothing();

    if (i.completeness > 0) {
      await db.insert(communityZones).values({
        profileId: pid, community: i.community, subCommunity: i.subCommunity ?? null,
        caste: i.caste ?? null, gotra: i.gotra ?? null, motherTongue: i.motherTongue,
        preferredLang: 'hi', updatedAt: now(),
      }).onConflictDoNothing();
    }

    await db.insert(profileSections).values({
      profileId: pid,
      personal: i.sections.includes('personal'),
      family: i.sections.includes('family'),
      career: i.sections.includes('career'),
      lifestyle: i.sections.includes('lifestyle'),
      horoscope: i.sections.includes('horoscope'),
      photos: i.sections.includes('photos'),
      preferences: i.sections.includes('preferences'),
      personality: i.sections.includes('personality'),
      updatedAt: now(),
    }).onConflictDoNothing();

    if (i.sections.includes('photos') || i.contentLevel === 'full') {
      for (let k = 0; k < 2; k++) {
        photoCounter++;
        await db.insert(profilePhotos).values({
          id: photoId(photoCounter), profileId: pid,
          r2Key: `qa/photos/${i.userId}-${k + 1}.jpg`,
          isPrimary: k === 0, displayOrder: k, uploadedAt: now(),
        }).onConflictDoNothing();
      }
    }

    if (i.verificationStatus === 'MANUAL_REVIEW' || i.verificationStatus === 'INFO_REQUESTED') {
      kycCounter++;
      await db.insert(kycVerifications).values({
        id: kycId(kycCounter), profileId: pid,
        aadhaarVerified: false,
        aadhaarRefId: `MOCK-DGL-${MOCK_AADHAAR.replace(/-/g, '')}-${kycCounter}`,
        verificationLevel: 'BASIC',
        riskScore: i.verificationStatus === 'MANUAL_REVIEW' ? 45 : 30,
        adminNote: i.verificationStatus === 'INFO_REQUESTED'
          ? 'Admin requested clearer selfie + address proof.'
          : 'Auto-routed to manual review (mock pipeline).',
        attemptCount: 1, lastAttemptAt: now(), createdAt: now(), updatedAt: now(),
      }).onConflictDoNothing();
    }
  }
  console.info(`  ✅ ${INDIVIDUALS.length} individual profiles, ${photoCounter} photos, ${kycCounter} KYC-queue rows`);
}

async function seedVendors(): Promise<void> {
  console.info('🏪 vendors + pricing rules...');
  for (const [idx, v] of VENDORS.entries()) {
    const pid = venProfileId(idx + 1);
    const rupees = Number(v.basePaise) / 100;

    // vendor business listing (public)
    await db.insert(vendors).values({
      id: vendorRowId(idx + 1), userId: v.userId, businessName: v.businessName,
      category: v.category, city: v.city, state: v.state, verified: true, isActive: true,
      tagline: `${v.businessName} — trusted ${v.category.toLowerCase()} for your big day`,
      description: `QA seed vendor. Realistic ${v.category.toLowerCase()} pricing for engine testing.`,
      phone: phone(phoneOffset(v.userId)), email: email(v.userId),
      priceMin: (rupees * v.floor).toFixed(2), priceMax: (rupees * v.ceiling).toFixed(2),
      status: 'APPROVED', createdAt: now(), updatedAt: now(),
    }).onConflictDoNothing();

    // a matrimonial profiles row is the FK target for pricing_rules + vendor_capacity;
    // isActive=false + PENDING keeps the vendor OUT of the match feed.
    await db.insert(profiles).values({
      id: pid, userId: v.userId, verificationStatus: 'PENDING', premiumTier: 'FREE',
      profileCompleteness: 0, isActive: false, createdAt: now(), updatedAt: now(),
    }).onConflictDoNothing();

    await db.insert(pricingRules).values({
      id: pricingRuleId(idx + 1), profileId: pid, serviceCategory: v.category,
      basePaise: v.basePaise, currency: 'INR',
      floorMultiplier: v.floor, ceilingMultiplier: v.ceiling,
      muhuratMultiplier: v.muhurat, offSeasonMultiplier: v.offSeason, demandMultiplier: 1,
      status: 'ACTIVE', createdAt: now(), updatedAt: now(),
    }).onConflictDoNothing();

    const start = new Date(`${REF_YEAR}-11-01T00:00:00Z`);
    const end = new Date(`${REF_YEAR}-11-02T00:00:00Z`);
    await db.insert(vendorCapacity).values({
      id: capacityId(idx + 1), profileId: pid, startAt: start, endAt: end,
      status: 'OPEN', maxBookings: 3, bookedCount: 0, offSeason: false,
      notes: 'QA seed capacity window', createdAt: now(), updatedAt: now(),
    }).onConflictDoNothing();

    await db.insert(vendorServices).values({
      id: serviceId(idx + 1), vendorId: vendorRowId(idx + 1), name: v.serviceName,
      description: `${v.serviceName} by ${v.businessName}`,
      priceFrom: (rupees * v.floor).toFixed(2), priceTo: (rupees * v.ceiling).toFixed(2),
      priceUnit: v.priceUnit, isActive: true, createdAt: now(),
    }).onConflictDoNothing();
  }
  console.info(`  ✅ ${VENDORS.length} vendors (each with pricing_rule + capacity + service)`);
}

async function seedFamily(): Promise<void> {
  console.info('👪 parent-child links...');
  const profIdxByUser = new Map<string, number>();
  INDIVIDUALS.forEach((i, idx) => profIdxByUser.set(i.userId, idx + 1));

  for (const l of PARENT_LINKS) {
    await db.insert(parentChildLinks).values({
      parentUserId: l.parentUserId, childUserId: l.childUserId,
      relationship: l.relationship, permissions: l.permissions,
      childConsentStatus: l.consent,
      childConsentedAt: l.consent === 'APPROVED' ? now() : null,
      revokedAt: l.consent === 'REVOKED' ? now() : null,
      createdAt: now(),
    }).onConflictDoNothing();
  }

  // standalone collaborator roster row (qa-fam-06 manages qa-ind-11's profile)
  const childIdx = profIdxByUser.get(STANDALONE_FAMILY.childUserId);
  if (childIdx) {
    await db.insert(familyMembers).values({
      id: familyMemberId(1), profileId: indProfileId(childIdx),
      name: STANDALONE_FAMILY.name, relationship: STANDALONE_FAMILY.relationship,
      isManaging: true, managerUserId: STANDALONE_FAMILY.userId, addedAt: now(),
    }).onConflictDoNothing();
  }
  console.info(`  ✅ ${PARENT_LINKS.length} parent-child links (+ 1 standalone collaborator)`);
}

async function seedCoordinators(): Promise<void> {
  console.info('🎯 QA wedding + coordinator assignments...');
  const owner = indProfileId(1);   // qa-ind-01 Aditya
  const partner = indProfileId(3); // qa-ind-03 Sneha
  await db.insert(weddings).values({
    id: QA_WEDDING_ID, profileId: owner, partnerProfileId: partner,
    title: 'QA Test Wedding', weddingDate: `${REF_YEAR}-12-10`,
    venueName: 'Royal Garden Banquets', venueCity: 'Pune',
    brideName: 'Sneha Kulkarni', groomName: 'Aditya Deshmukh',
    status: 'PLANNING', createdAt: now(), updatedAt: now(),
  }).onConflictDoNothing();

  let n = 0;
  for (const c of COORDINATORS) {
    if (!c.assigned) continue;
    n++;
    await db.insert(weddingCoordinatorAssignments).values({
      id: coordAssignId(n), weddingId: QA_WEDDING_ID, coordinatorUserId: c.userId,
      scope: c.scope, assignedBy: 'qa-ind-01', assignedAt: now(),
    }).onConflictDoNothing();
  }
  console.info(`  ✅ QA wedding + ${n} coordinator assignment(s) (1 coordinator left unassigned)`);
}

async function seedContent(): Promise<void> {
  console.info('🍃 profile content (mockStore + Mongo)...');
  const contents = INDIVIDUALS.map(makeContent).filter((c): c is Record<string, unknown> => c !== null);

  // 1) mockStore.json (merge by userId) — covers USE_MOCK_SERVICES mode
  let existing: Record<string, Record<string, unknown>> = {};
  if (existsSync(STORE_FILE)) {
    try { existing = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as typeof existing; } catch { /* fresh */ }
  }
  for (const c of contents) {
    const uid = c['userId'] as string;
    existing[uid] = { ...(existing[uid] ?? {}), ...c };
  }
  mkdirSync(dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(existing, null, 2), 'utf8');
  console.info(`  ✅ mockStore.json: ${contents.length} profile_contents`);

  // 2) real Mongo (only if MONGODB_URI set) — covers MONGO_LIVE mode
  if (!process.env['MONGODB_URI']) {
    console.warn('  ⚠️  MONGODB_URI not set — skipped live Mongo (mockStore.json populated)');
    return;
  }
  try {
    await mongoose.connect(process.env['MONGODB_URI'], { serverSelectionTimeoutMS: 3000 });
    for (const c of contents) {
      await ProfileContentModel.findOneAndUpdate({ userId: c['userId'] }, c, { upsert: true, new: true });
    }
    console.info(`  ✅ Mongo profiles_content: ${contents.length}`);
    await mongoose.disconnect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`  ⚠️  Mongo skipped (${msg}). mockStore.json still populated.`);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }
}

function writeCredentials(): void {
  const otp = process.env['MOCK_OTP_VALUE'] ?? '<set MOCK_OTP_VALUE in root .env>';
  const lines: string[] = [];
  lines.push('# QA Test Accounts — Credentials Sheet (LOCAL, gitignored)');
  lines.push('');
  lines.push(`> Generated by \`db:seed:test-accounts\`. **Never commit.** Login OTP (mock mode) = \`${otp}\``);
  lines.push('> Login: `POST /api/auth/phone-number/send-otp { phoneNumber }` then `POST /api/auth/phone-number/verify { phoneNumber, code }`.');
  lines.push('');
  lines.push('## Individuals');
  lines.push('| Phone | Name | Gender | Age | Cluster | Completion | Active | KYC | userId | profileId |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  INDIVIDUALS.forEach((i, idx) => {
    lines.push(`| ${phone(phoneOffset(i.userId))} | ${i.name} | ${i.gender} | ${i.age} | ${i.cluster} | ${i.completeness}% | ${i.isActive ? 'yes' : 'no'} | ${i.verificationStatus} | ${i.userId} | ${indProfileId(idx + 1)} |`);
  });
  lines.push('');
  lines.push('### Matchable pairs (same religion + opposite gender + active + VERIFIED)');
  lines.push('Within each cluster the opposite-gender members surface in each other\'s feed (Hindu clusters also cross-match by religion). Bust `match_feed:{userId}` in Redis before testing.');
  lines.push('');
  lines.push('## Vendors (pricing engine)');
  lines.push('| Phone | Business | Category | City | base ₹ | floor× | ceiling× | muhurat× | offSeason× | userId | profileId |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  VENDORS.forEach((v, idx) => {
    lines.push(`| ${phone(phoneOffset(v.userId))} | ${v.businessName} | ${v.category} | ${v.city} | ${(Number(v.basePaise) / 100).toLocaleString('en-IN')} | ${v.floor} | ${v.ceiling} | ${v.muhurat} | ${v.offSeason} | ${v.userId} | ${venProfileId(idx + 1)} |`);
  });
  lines.push('');
  lines.push('> `qa-ven-08` (Luminous Events Lighting) has a tight ceiling (1.1) so the muhurat premium (1.25) hits the clamp → `clamp_hit=true`.');
  lines.push('');
  lines.push('## Family members (parent-child links)');
  lines.push('| Phone | Name | userId | manages child | permission | consent |');
  lines.push('|---|---|---|---|---|---|');
  PARENT_LINKS.forEach((l) => {
    lines.push(`| ${phone(phoneOffset(l.parentUserId))} | ${l.parentName} | ${l.parentUserId} | ${l.childUserId} | ${l.permissions} | ${l.consent} |`);
  });
  lines.push(`| ${phone(phoneOffset(STANDALONE_FAMILY.userId))} | ${STANDALONE_FAMILY.name} | ${STANDALONE_FAMILY.userId} | ${STANDALONE_FAMILY.childUserId} (roster only) | — | — |`);
  lines.push('');
  lines.push('## Coordinators / Admins / Support');
  lines.push('| Phone | Name | Role | userId | Notes |');
  lines.push('|---|---|---|---|---|');
  COORDINATORS.forEach((c) => lines.push(`| ${phone(phoneOffset(c.userId))} | ${c.name} | EVENT_COORDINATOR | ${c.userId} | ${c.assigned ? `assigned to QA wedding (${c.scope})` : 'unassigned (empty dashboard)'} |`));
  ADMINS.forEach((a) => lines.push(`| ${phone(phoneOffset(a.userId))} | ${a.name} | ADMIN | ${a.userId} | KYC + vendor approval queue |`));
  SUPPORTS.forEach((s) => lines.push(`| ${phone(phoneOffset(s.userId))} | ${s.name} | SUPPORT | ${s.userId} | complaint resolution |`));
  lines.push('');
  lines.push(`QA wedding id: \`${QA_WEDDING_ID}\` (owner qa-ind-01, partner qa-ind-03).`);

  const out = resolve(__dirname, 'qa-credentials.local.md');
  writeFileSync(out, lines.join('\n'), 'utf8');
  console.info(`  ✅ credentials → ${out}`);
}

async function seed(): Promise<void> {
  console.info('🌱 Smart Shaadi — QA Test-Account Seed');
  console.info(`   Target counts: ${JSON.stringify(COUNTS)}`);
  await seedUsers();
  await seedVendors();
  await seedFamily();
  await seedCoordinators();
  await seedContent();
  writeCredentials();
  console.info('✅ QA seed complete. Bust Redis match_feed:* before testing the feed.');
}

// ── TEARDOWN ──────────────────────────────────────────────────────────────────
async function teardown(): Promise<void> {
  console.info('🧹 QA teardown — removing every qa-% account (full-demo untouched)...');
  // FK-safe order. profiles delete cascades its children (communityZones, profileSections,
  // profile_photos, kyc_verifications, pricing_rules, vendor_capacity, safety_mode_unlocks).
  await db.execute(sql`DELETE FROM wedding_coordinator_assignments WHERE wedding_id = ${QA_WEDDING_ID} OR coordinator_user_id LIKE 'qa-%'`);
  await db.execute(sql`DELETE FROM wedding_tasks WHERE wedding_id = ${QA_WEDDING_ID}`);
  await db.execute(sql`DELETE FROM weddings WHERE id = ${QA_WEDDING_ID}`);
  await db.execute(sql`DELETE FROM family_members WHERE manager_user_id LIKE 'qa-%' OR profile_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%')`);
  await db.execute(sql`DELETE FROM parent_child_links WHERE parent_user_id LIKE 'qa-%' OR child_user_id LIKE 'qa-%'`);
  await db.execute(sql`DELETE FROM vendor_services WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id LIKE 'qa-%')`);
  await db.execute(sql`DELETE FROM vendor_event_types WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id LIKE 'qa-%')`);
  await db.execute(sql`DELETE FROM vendors WHERE user_id LIKE 'qa-%'`);
  // defensive: match/block/report rows referencing qa profiles (none seeded, but keep idempotent —
  // these FKs have no ON DELETE CASCADE so they must go before the profiles delete)
  await db.execute(sql`DELETE FROM match_request_reports WHERE reporter_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%') OR reported_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%')`);
  await db.execute(sql`DELETE FROM match_requests WHERE sender_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%') OR receiver_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%')`);
  await db.execute(sql`DELETE FROM match_scores WHERE profile_a IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%') OR profile_b IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%')`);
  await db.execute(sql`DELETE FROM blocked_users WHERE blocker_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%') OR blocked_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa-%')`);
  await db.execute(sql`DELETE FROM profiles WHERE user_id LIKE 'qa-%'`);
  await db.execute(sql`DELETE FROM session WHERE user_id LIKE 'qa-%'`);
  await db.execute(sql`DELETE FROM account WHERE user_id LIKE 'qa-%'`);
  await db.execute(sql`DELETE FROM verification WHERE identifier LIKE ${'+91' + PHONE_BASE.toString().slice(0, 4) + '%'}`);
  await db.execute(sql`DELETE FROM "user" WHERE id LIKE 'qa-%'`);
  console.info('  ✅ PostgreSQL qa-% rows removed');

  // mockStore.json — drop qa-* keys
  if (existsSync(STORE_FILE)) {
    try {
      const store = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Record<string, unknown>;
      let removed = 0;
      for (const k of Object.keys(store)) if (k.startsWith('qa-')) { delete store[k]; removed++; }
      writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
      console.info(`  ✅ mockStore.json: removed ${removed} qa-* entries`);
    } catch (e) {
      console.warn(`  ⚠️  mockStore.json cleanup skipped: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // real Mongo
  if (process.env['MONGODB_URI']) {
    try {
      await mongoose.connect(process.env['MONGODB_URI'], { serverSelectionTimeoutMS: 3000 });
      const res = await ProfileContentModel.deleteMany({ userId: { $regex: '^qa-' } });
      console.info(`  ✅ Mongo profiles_content: removed ${res.deletedCount ?? 0}`);
      await mongoose.disconnect();
    } catch (e) {
      console.warn(`  ⚠️  Mongo cleanup skipped: ${e instanceof Error ? e.message : String(e)}`);
      try { await mongoose.disconnect(); } catch { /* ignore */ }
    }
  }
  console.info('🧹 Teardown complete. (Redis: run `redis-cli -u $REDIS_URL --scan --pattern "match_feed:qa-*" | xargs redis-cli -u $REDIS_URL DEL` to clear cached feeds.)');
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    if (REMOVE) await teardown(); else await seed();
  } finally {
    await pool.end();
  }
})().catch((e) => { console.error('❌ test-accounts failed:', e); process.exit(1); });
