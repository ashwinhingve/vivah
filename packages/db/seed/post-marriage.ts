/**
 * Post-marriage services seed — Phase 8, Unit 8.2.
 * packages/db/seed/post-marriage.ts
 *
 * Seeds FICTIONAL service-partner supply so the post-marriage feature works
 * end-to-end in production before any partner agreement is signed.
 *
 * Same rules as the 8.1 seed:
 *   * Every partner name is invented. No real company is named or alluded to.
 *   * is_placeholder = true is internal provenance only — it never hides,
 *     filters or down-ranks a row. Unlike 8.1 there is no booking path in this
 *     unit at all (every service converts through an enquiry), so the flag
 *     gates nothing commercially here.
 *   * Idempotent: fixed sentinel UUIDs + onConflictDoNothing throughout.
 *
 * CONTACT DETAILS use @seed.invalid and 000-prefixed numbers. RFC 2606 reserves
 * .invalid so it can never be registered — a stray notification cannot reach a
 * real inbox, and nobody can accidentally phone a stranger. Enquiries land in
 * the ADMIN triage queue (/api/v1/post-marriage/admin/enquiries), which is where
 * a lead against placeholder supply is meant to be answered.
 *
 * CATEGORIES are seeded as ROWS, not as an enum. An operator adds "pet care" or
 * retires "gifting registry" from the admin UI without a migration — which is
 * the whole reason 0037 made this a table.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { eq } from 'drizzle-orm';
import {
  cities,
  postMarriageCategories, servicePartners, postMarriageServices,
} from '../schema/index.js';

config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

// 'e0' namespace = post-marriage seed data.
const categoryId = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const partnerId  = (n: number) => `e0000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const serviceId  = (n: number) => `e0000002-0000-4000-8000-${String(n).padStart(12, '0')}`;

// ── Categories ───────────────────────────────────────────────────────────────

interface SeedCategory { n: number; slug: string; name: string; icon: string; description: string }

const CATEGORIES: SeedCategory[] = [
  { n: 1, slug: 'honeymoon-planning', name: 'Honeymoon Planning', icon: 'Plane',
    description: 'Itineraries, flights, stays and visas for the trip after the wedding.' },
  { n: 2, slug: 'home-setup', name: 'Home Setup & Interiors', icon: 'Sofa',
    description: 'Furnishing, interiors and move-in help for the couple\'s first home together.' },
  { n: 3, slug: 'legal-name-change', name: 'Legal & Name Change', icon: 'FileText',
    description: 'Marriage registration, name-change gazette filings, and document updates.' },
  { n: 4, slug: 'gifting-registry', name: 'Gifting Registry', icon: 'Gift',
    description: 'Shared registries so guests can contribute to what the couple actually needs.' },
  { n: 5, slug: 'relationship-counselling', name: 'Relationship Counselling', icon: 'HeartHandshake',
    description: 'Confidential counselling for couples and families, in person or online.' },
  { n: 6, slug: 'financial-planning', name: 'Financial Planning', icon: 'PiggyBank',
    description: 'Joint accounts, insurance, tax and investment planning for a new household.' },
  { n: 7, slug: 'health-wellness', name: 'Health & Wellness', icon: 'Activity',
    description: 'Post-wedding health checks, fertility counselling, nutrition and fitness.' },
  { n: 8, slug: 'anniversary-planning', name: 'Anniversary Planning', icon: 'CalendarHeart',
    description: 'Milestone anniversary celebrations, from a private dinner to a vow renewal.' },
];

// ── Partners ─────────────────────────────────────────────────────────────────
// city is NULL where the service is genuinely delivered remotely — that nullable
// column exists precisely so a legal filing service is not forced to claim a
// street address it does not have.

interface SeedPartner {
  n: number; cat: number; name: string; slug: string;
  city: string | null; state: string | null;
  rating: string; description: string;
}

const PARTNERS: SeedPartner[] = [
  { n: 1, cat: 1, name: 'Farhorizon Journeys', slug: 'farhorizon-journeys', city: 'Mumbai', state: 'Maharashtra', rating: '4.70',
    description: 'Honeymoon specialists handling flights, stays, visas and on-trip support. Twelve years of couple-only itineraries across Asia and Europe.' },
  { n: 2, cat: 1, name: 'Two Passports Travel', slug: 'two-passports-travel', city: 'Bangalore', state: 'Karnataka', rating: '4.50',
    description: 'Budget-conscious honeymoon planning for couples who would rather spend on experiences than on flights. Strong on Southeast Asia and the Andamans.' },
  { n: 3, cat: 2, name: 'Nestwell Interiors', slug: 'nestwell-interiors', city: 'Pune', state: 'Maharashtra', rating: '4.60',
    description: 'Turnkey interiors for first homes. Modular kitchens, wardrobes and full-flat packages with a fixed timeline and a written completion date.' },
  { n: 4, cat: 2, name: 'Kalash Home Studio', slug: 'kalash-home-studio', city: 'Delhi', state: 'Delhi NCR', rating: '4.40',
    description: 'Interior styling that works around what the couple already owns, rather than replacing it. Room-by-room engagements as well as whole homes.' },
  { n: 5, cat: 3, name: 'Vidhi Legal Associates', slug: 'vidhi-legal-associates', city: null, state: null, rating: '4.80',
    description: 'Marriage registration, name-change gazette notification, and the downstream updates to PAN, passport, bank and employer records. Delivered remotely across India.' },
  { n: 6, cat: 3, name: 'Sanad Documentation Services', slug: 'sanad-documentation', city: null, state: null, rating: '4.50',
    description: 'Document-only service for couples who want the paperwork handled without legal advice. Fixed fee per filing, no hourly billing.' },
  { n: 7, cat: 4, name: 'Shagun Registry', slug: 'shagun-registry', city: null, state: null, rating: '4.60',
    description: 'A shared gift registry couples share with guests as a single link. Contributions can go to listed items or to a pooled fund.' },
  { n: 8, cat: 4, name: 'Uphaar Collective', slug: 'uphaar-collective', city: 'Jaipur', state: 'Rajasthan', rating: '4.30',
    description: 'Curated registry of Indian artisan homeware — block-printed linen, brassware and stoneware, sourced directly from craft clusters.' },
  { n: 9, cat: 5, name: 'Sahaj Counselling Collective', slug: 'sahaj-counselling', city: null, state: null, rating: '4.90',
    description: 'Licensed couples counsellors offering confidential sessions online or in person. Pre-marital, early-marriage and family-mediation formats.' },
  { n: 10, cat: 5, name: 'Setu Family Therapy', slug: 'setu-family-therapy', city: 'Hyderabad', state: 'Telangana', rating: '4.70',
    description: 'Family-systems therapy for joint-family transitions — in-law dynamics, relocation stress and boundary-setting in a new household.' },
  { n: 11, cat: 6, name: 'Arthasetu Advisors', slug: 'arthasetu-advisors', city: 'Mumbai', state: 'Maharashtra', rating: '4.60',
    description: 'SEBI-registered advisers building a joint financial plan: emergency fund, insurance cover, tax structure and long-horizon investing.' },
  { n: 12, cat: 6, name: 'Nayi Shuruaat Financial', slug: 'nayi-shuruaat-financial', city: 'Indore', state: 'Madhya Pradesh', rating: '4.40',
    description: 'Financial planning aimed at first-generation earners. Plain-language sessions in Hindi or English, with a written plan at the end.' },
  { n: 13, cat: 7, name: 'Arogya Couples Clinic', slug: 'arogya-couples-clinic', city: 'Bangalore', state: 'Karnataka', rating: '4.50',
    description: 'Post-wedding health screening for couples — full panels, fertility counselling and a joint consultation covering both results together.' },
  { n: 14, cat: 7, name: 'Sthir Wellness Studio', slug: 'sthir-wellness-studio', city: 'Pune', state: 'Maharashtra', rating: '4.40',
    description: 'Nutrition and fitness programmes designed for two, on the premise that habits formed together tend to hold.' },
  { n: 15, cat: 8, name: 'Punarmilan Events', slug: 'punarmilan-events', city: 'Delhi', state: 'Delhi NCR', rating: '4.60',
    description: 'Anniversary and vow-renewal planning, from a private dinner for two to a first-anniversary reception for a hundred.' },
  { n: 16, cat: 8, name: 'Smriti Celebrations', slug: 'smriti-celebrations', city: 'Ahmedabad', state: 'Gujarat', rating: '4.30',
    description: 'Milestone anniversary events for extended families, including photo-archive films built from the couple\'s own wedding footage.' },
];

// ── Services ─────────────────────────────────────────────────────────────────
// Price units exercise every enum value, including QUOTE (no number at all) —
// so the browse sort's NULLS LAST handling has real rows to prove itself on.

interface SeedService {
  n: number; partner: number; title: string; slug: string;
  from: string | null; to: string | null;
  unit: 'FIXED' | 'PER_HOUR' | 'PER_MONTH' | 'PER_PERSON' | 'QUOTE';
  description: string;
}

const SERVICES: SeedService[] = [
  { n: 1, partner: 1, title: 'Maldives Honeymoon — 6 Nights', slug: 'maldives-honeymoon-6-nights',
    from: '285000.00', to: '420000.00', unit: 'FIXED',
    description: 'Six nights in an overwater villa with return flights from Mumbai or Delhi, transfers, breakfast and one private sandbank dinner. Price is per couple.' },
  { n: 2, partner: 1, title: 'Europe Multi-City — 12 Nights', slug: 'europe-multi-city-12-nights',
    from: '520000.00', to: '880000.00', unit: 'FIXED',
    description: 'Twelve nights across three cities with rail passes, four-star stays and Schengen visa assistance. Itinerary built around the couple\'s pace.' },
  { n: 3, partner: 1, title: 'Visa & Documentation Assistance', slug: 'honeymoon-visa-assistance',
    from: '12000.00', to: null, unit: 'FIXED',
    description: 'Standalone visa support for couples who have booked their own travel. Covers forms, appointment booking and document review.' },
  { n: 4, partner: 2, title: 'Andaman Islands — 5 Nights', slug: 'andaman-islands-5-nights',
    from: '96000.00', to: '145000.00', unit: 'FIXED',
    description: 'Five nights across Havelock and Port Blair with ferries, breakfast and a snorkelling day. Domestic travel only — no visa needed.' },
  { n: 5, partner: 2, title: 'Bali Honeymoon — 7 Nights', slug: 'bali-honeymoon-7-nights',
    from: '148000.00', to: '235000.00', unit: 'FIXED',
    description: 'Seven nights split between Ubud and the south coast, with return flights, private transfers and a villa with a plunge pool.' },
  { n: 6, partner: 3, title: 'Full Home Interiors — 2BHK', slug: 'full-home-interiors-2bhk',
    from: '650000.00', to: '1400000.00', unit: 'FIXED',
    description: 'Complete 2BHK fit-out: modular kitchen, wardrobes, false ceiling, lighting and painting, with a written 60-day completion date.' },
  { n: 7, partner: 3, title: 'Modular Kitchen Only', slug: 'modular-kitchen-only',
    from: '185000.00', to: '450000.00', unit: 'FIXED',
    description: 'Kitchen-only engagement with hardware, counters and appliance integration. Suits couples moving into a home that is otherwise finished.' },
  { n: 8, partner: 4, title: 'Room-by-Room Styling', slug: 'room-by-room-styling',
    from: '35000.00', to: null, unit: 'FIXED',
    description: 'Per-room styling that works around existing furniture. Includes a layout plan, palette and a sourcing list the couple can buy from themselves.' },
  { n: 9, partner: 4, title: 'Design Consultation', slug: 'interior-design-consultation',
    from: '3500.00', to: null, unit: 'PER_HOUR',
    description: 'Hourly consultation for couples managing their own fit-out and wanting a professional eye on decisions before committing.' },
  { n: 10, partner: 5, title: 'Marriage Registration Assistance', slug: 'marriage-registration-assistance',
    from: '18000.00', to: null, unit: 'FIXED',
    description: 'End-to-end marriage registration: document preparation, appointment booking and representation at the registrar where permitted.' },
  { n: 11, partner: 5, title: 'Name Change — Full Package', slug: 'name-change-full-package',
    from: '24000.00', to: null, unit: 'FIXED',
    description: 'Gazette notification plus downstream updates to PAN, passport, Aadhaar, bank and employer records. Handled remotely, start to finish.' },
  { n: 12, partner: 5, title: 'Legal Consultation', slug: 'post-marriage-legal-consultation',
    from: '4500.00', to: null, unit: 'PER_HOUR',
    description: 'Hourly advice on property, succession or prenuptial matters arising after marriage.' },
  { n: 13, partner: 6, title: 'Gazette Notification Filing', slug: 'gazette-notification-filing',
    from: '8500.00', to: null, unit: 'FIXED',
    description: 'Gazette name-change filing only. Fixed fee, no legal advice attached — for couples who know exactly what they need.' },
  { n: 14, partner: 7, title: 'Digital Gift Registry', slug: 'digital-gift-registry',
    from: null, to: null, unit: 'QUOTE',
    description: 'A shared registry link for guests. Priced on the registry size and the payment rails used — request a quote for a figure.' },
  { n: 15, partner: 8, title: 'Artisan Homeware Registry', slug: 'artisan-homeware-registry',
    from: '2500.00', to: '80000.00', unit: 'FIXED',
    description: 'Curated registry of block-printed linen, brassware and stoneware sourced from craft clusters. Range reflects individual item prices.' },
  { n: 16, partner: 9, title: 'Couples Counselling Session', slug: 'couples-counselling-session',
    from: '2800.00', to: null, unit: 'PER_HOUR',
    description: 'Confidential fifty-minute session with a licensed counsellor, online or in person. No referral needed.' },
  { n: 17, partner: 9, title: 'Six-Session Programme', slug: 'counselling-six-session-programme',
    from: '15000.00', to: null, unit: 'FIXED',
    description: 'A structured six-session programme for couples in the first year, at a lower rate than booking six sessions individually.' },
  { n: 18, partner: 10, title: 'Family Mediation', slug: 'family-mediation',
    from: '4200.00', to: null, unit: 'PER_HOUR',
    description: 'Facilitated sessions for joint-family transitions — in-law dynamics, relocation and boundary-setting, with all parties in the room.' },
  { n: 19, partner: 11, title: 'Joint Financial Plan', slug: 'joint-financial-plan',
    from: '25000.00', to: null, unit: 'FIXED',
    description: 'A written plan covering emergency fund, insurance cover, tax structure and a long-horizon investment allocation, with one review after six months.' },
  { n: 20, partner: 11, title: 'Ongoing Advisory', slug: 'ongoing-financial-advisory',
    from: '6000.00', to: null, unit: 'PER_MONTH',
    description: 'Monthly retainer covering portfolio review, rebalancing and ad-hoc questions as the household\'s circumstances change.' },
  { n: 21, partner: 12, title: 'First-Year Money Workshop', slug: 'first-year-money-workshop',
    from: '9500.00', to: null, unit: 'FIXED',
    description: 'A half-day workshop for couples on joint accounts, budgeting and the first year\'s tax position. Hindi or English.' },
  { n: 22, partner: 13, title: 'Couples Health Screening', slug: 'couples-health-screening',
    from: '12500.00', to: '28000.00', unit: 'FIXED',
    description: 'Full blood panel, thyroid, vitamin and metabolic screening for both partners, with a joint consultation covering both sets of results.' },
  { n: 23, partner: 13, title: 'Fertility Counselling', slug: 'fertility-counselling',
    from: '5500.00', to: null, unit: 'PER_HOUR',
    description: 'Consultation with a fertility specialist covering baseline testing and planning. No obligation to proceed to treatment.' },
  { n: 24, partner: 14, title: 'Couples Fitness Programme', slug: 'couples-fitness-programme',
    from: '8000.00', to: null, unit: 'PER_MONTH',
    description: 'A twelve-week programme for two with paired sessions, a nutrition plan and monthly measurement reviews.' },
  { n: 25, partner: 15, title: 'First Anniversary Celebration', slug: 'first-anniversary-celebration',
    from: '85000.00', to: '350000.00', unit: 'FIXED',
    description: 'Anniversary event planning from a private dinner to a hundred-guest reception, including venue, catering and decor coordination.' },
  { n: 26, partner: 15, title: 'Vow Renewal Ceremony', slug: 'vow-renewal-ceremony',
    from: '145000.00', to: '600000.00', unit: 'FIXED',
    description: 'Full vow-renewal planning for milestone anniversaries, with ceremony design, officiant and guest coordination.' },
  { n: 27, partner: 16, title: 'Anniversary Film from Wedding Footage', slug: 'anniversary-film-wedding-footage',
    from: '32000.00', to: null, unit: 'FIXED',
    description: 'A short film cut from the couple\'s own wedding footage and photographs, delivered for a milestone anniversary.' },
  { n: 28, partner: 16, title: 'Milestone Family Gathering', slug: 'milestone-family-gathering',
    from: '1800.00', to: null, unit: 'PER_PERSON',
    description: 'Per-guest planning and catering for extended-family anniversary gatherings. Minimum fifty guests.' },
];

export async function seedPostMarriage(): Promise<void> {
  // ── 1. Categories ──────────────────────────────────────────────────────────
  for (const c of CATEGORIES) {
    await db.insert(postMarriageCategories).values({
      id: categoryId(c.n), slug: c.slug, name: c.name,
      description: c.description, icon: c.icon,
      sortOrder: c.n, isActive: true,
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  // ── 2. Partners ────────────────────────────────────────────────────────────
  // Resolve the city registry link by name where the partner has a city, using
  // the same rule as migration 0039 and the service layer.
  const cityRows = await db.select({ id: cities.id, name: cities.name }).from(cities);
  const cityByName = new Map(cityRows.map((r) => [r.name.trim().toLowerCase(), r.id]));

  for (const p of PARTNERS) {
    await db.insert(servicePartners).values({
      id:         partnerId(p.n),
      categoryId: categoryId(p.cat),
      name:       p.name,
      slug:       p.slug,
      city:       p.city,
      cityId:     p.city ? cityByName.get(p.city.trim().toLowerCase()) ?? null : null,
      state:      p.state,
      countryCode: 'IN',
      description: p.description,
      // RFC 2606 reserves .invalid — it can never resolve, so a stray
      // notification to a fictional partner cannot reach a real inbox.
      contactEmail: `${p.slug}@seed.invalid`,
      // 000 is not a valid Indian STD code, so this cannot dial a real number.
      contactPhone: `+91-000-${String(1000000 + p.n).slice(0, 7)}`,
      websiteUrl:   null,
      logoUrl:      '/seed/partner-logo.svg',
      rating:       p.rating,
      isPlaceholder: true,
      isActive:      true,
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  // ── 3. Services ────────────────────────────────────────────────────────────
  for (const s of SERVICES) {
    const partner = PARTNERS.find((p) => p.n === s.partner);
    if (!partner) throw new Error(`Seed error: service ${s.slug} references unknown partner ${s.partner}`);

    await db.insert(postMarriageServices).values({
      id:         serviceId(s.n),
      partnerId:  partnerId(s.partner),
      categoryId: categoryId(partner.cat),
      title:      s.title,
      slug:       s.slug,
      description: s.description,
      priceFrom:  s.from,
      priceTo:    s.to,
      priceUnit:  s.unit,
      currency:   'INR',
      isPlaceholder: true,
      isActive:      true,
      sortOrder:     s.n,
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  console.log(
    `  ✓ 8.2 supply: ${CATEGORIES.length} categories, ${PARTNERS.length} partners, `
    + `${SERVICES.length} services (all is_placeholder = true)`,
  );
}

/** Remove every 8.2 seed row. Children first — the category FK is RESTRICT. */
export async function removePostMarriage(): Promise<void> {
  for (const s of SERVICES) {
    await db.delete(postMarriageServices).where(eq(postMarriageServices.id, serviceId(s.n)));
  }
  for (const p of PARTNERS) {
    await db.delete(servicePartners).where(eq(servicePartners.id, partnerId(p.n)));
  }
  for (const c of CATEGORIES) {
    await db.delete(postMarriageCategories).where(eq(postMarriageCategories.id, categoryId(c.n)));
  }
  console.log('  ✓ 8.2 seed rows removed');
}

if (process.argv[1]?.includes('post-marriage')) {
  const run = process.argv.includes('--remove') ? removePostMarriage : seedPostMarriage;
  run()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error('❌ 8.2 seed failed:', e); process.exit(1); });
}
