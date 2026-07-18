/**
 * build-demo-dataset.mjs — deterministic generator for the Sprint J demo
 * dataset (Units 6.4/6.5): ~150 realistic Indian vendors across the 10
 * registry cities plus six months of back-dated users/bookings/payments/
 * activity, so gap detection, utilization, forecasting and every marketing
 * segment have real signal.
 *
 * Same convention as build-calendar-dataset.mjs: run this script, commit the
 * emitted JSON. Everything is derived from a fixed PRNG seed and a fixed
 * "now" anchor — re-running always reproduces byte-identical output, so the
 * dataset is reviewable in the PR and the loader (demoTraffic.ts) stays dumb.
 *
 *   node packages/db/seed/data/build-demo-dataset.mjs
 *     → packages/db/seed/data/demo-traffic-india.json
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), 'demo-traffic-india.json');

// Fixed anchor — NOT Date.now(); determinism is the whole point.
const NOW = Date.parse('2026-07-18T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

// mulberry32 — tiny deterministic PRNG.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260718);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (min, max) => min + rnd() * (max - min);
const int = (min, max) => Math.floor(between(min, max + 1));
const iso = (ms) => new Date(ms).toISOString();
const hex = (n, w) => n.toString(16).padStart(w, '0');
// Deterministic, namespaced, valid-format UUIDs: dX000000-0000-4000-8000-<seq>.
const uid = (ns, n) => `d${ns}000000-0000-4000-8000-${hex(n, 12)}`;

// ── Cities (names MUST match the 0038 registry rows exactly for backfill) ────
const CITIES = [
  { name: 'Mumbai',    state: 'Maharashtra',    weight: 1.5 },
  { name: 'Delhi',     state: 'Delhi NCR',      weight: 1.5 },
  { name: 'Bangalore', state: 'Karnataka',      weight: 1.3 },
  { name: 'Hyderabad', state: 'Telangana',      weight: 1.2 },
  { name: 'Pune',      state: 'Maharashtra',    weight: 1.1 },
  { name: 'Jaipur',    state: 'Rajasthan',      weight: 1.0 },
  { name: 'Ahmedabad', state: 'Gujarat',        weight: 1.0 },
  { name: 'Lucknow',   state: 'Uttar Pradesh',  weight: 0.9 },
  { name: 'Indore',    state: 'Madhya Pradesh', weight: 0.8 },
  { name: 'Bhopal',    state: 'Madhya Pradesh', weight: 0.8 },
];

// Per-category business-name building blocks + price bands (rupees, whole
// event) + service templates. Bands roughly track real Indian wedding rates.
const CATEGORIES = {
  PHOTOGRAPHY: {
    suffixes: ['Wedding Photography', 'Studios', 'Moments', 'Frames', 'Clicks'],
    price: [40000, 300000],
    services: [
      ['Full-Day Wedding Coverage', 'Two photographers, 600+ edited photos, online gallery'],
      ['Candid + Traditional Combo', 'Candid lead + traditional second shooter, same-day teasers'],
      ['Pre-Wedding Shoot', 'Half-day outdoor shoot, 50 edited photos, location scouting'],
    ],
  },
  VIDEOGRAPHY: {
    suffixes: ['Films', 'Cinematics', 'Wedding Films', 'Motion Pictures'],
    price: [50000, 350000],
    services: [
      ['4K Highlight Film', '5-minute cinematic film, drone shots, licensed music'],
      ['Full Ceremony Film', 'Complete multi-cam ceremony record with clean audio'],
      ['Sangeet Same-Day Edit', 'Shot in the morning, screened at the evening function'],
    ],
  },
  CATERING: {
    suffixes: ['Caterers', 'Royal Rasoi', 'Bhoj', 'Kitchens', 'Hospitality'],
    price: [150000, 900000],
    services: [
      ['Veg Grand Buffet (per 100 guests)', '32-dish vegetarian spread with live counters'],
      ['Multi-Cuisine Package', 'North Indian, South Indian, Chinese and chaat stations'],
      ['Royal Rajasthani Thali', 'Traditional seated service with silver-look thalis'],
    ],
  },
  DECORATION: {
    suffixes: ['Decor', 'Events & Decor', 'Wedding Decorators', 'Themes'],
    price: [80000, 600000],
    services: [
      ['Mandap + Stage Package', 'Floral mandap, couple stage, entrance arch, aisle decor'],
      ['Theme Decor (Royal / Pastel)', 'Complete venue theming with drapes and centerpieces'],
      ['Haldi + Mehndi Setup', 'Marigold and genda-phool styling with seating clusters'],
    ],
  },
  VENUE: {
    suffixes: ['Palace', 'Gardens', 'Banquets', 'Lawns', 'Resort'],
    price: [200000, 1500000],
    services: [
      ['Wedding Day Package', 'Lawn + banquet hall, 800 guest capacity, valet parking'],
      ['Two-Day Wedding Block', 'All functions on-site with 40 guest rooms included'],
      ['Reception Evening', 'Banquet hall with in-house sound and lighting rig'],
    ],
  },
  MAKEUP: {
    suffixes: ['Makeovers', 'Bridal Studio', 'Glam Studio', 'Artistry'],
    price: [25000, 150000],
    services: [
      ['Bridal HD Makeup', 'HD base, draping, jewellery setting, one touch-up round'],
      ['Bride + 4 Family Package', 'Bridal look plus four family member makeovers'],
      ['Engagement + Wedding Combo', 'Two-event bridal package with trial session'],
    ],
  },
  MUSIC: {
    suffixes: ['Band', 'Baraat Band', 'DJs', 'Sangeet Crew', 'Beats'],
    price: [30000, 250000],
    services: [
      ['Baraat Brass Band', '12-piece brass band with dhol players and lightmen'],
      ['DJ Night (Sangeet + Reception)', 'DJ, sound rig, dance floor lighting, MC'],
      ['Live Sufi Night', '5-artist live ensemble for the evening function'],
    ],
  },
  LIGHTING: {
    suffixes: ['Lights', 'Illuminations', 'Light House', 'Roshni Works'],
    price: [40000, 300000],
    services: [
      ['Full Venue Illumination', 'Facade, pathway and tree wrapping with pixel control'],
      ['Sangeet Stage Lighting', 'Moving heads, beam bars and follow spot with operator'],
      ['Haveli Heritage Lighting', 'Warm heritage-style lighting for old-city venues'],
    ],
  },
  TRANSPORT: {
    suffixes: ['Travels', 'Wedding Cars', 'Cabs & Coaches', 'Rath Services'],
    price: [20000, 200000],
    services: [
      ['Vintage Car for Vidaai', 'Chauffeur-driven decorated vintage car, 6 hours'],
      ['Guest Shuttle Fleet', 'Three 45-seat coaches between hotel and venue'],
      ['Decorated Ghodi + Rath', 'Traditional baraat mare and chariot with handlers'],
    ],
  },
  PRIEST: {
    suffixes: ['Pandit Ji', 'Vedic Services', 'Purohit Seva', 'Shastri Ji'],
    price: [11000, 75000],
    services: [
      ['Complete Vivah Sanskar', 'All ceremonies from Ganesh puja to saptapadi, samagri included'],
      ['Engagement + Wedding Combo', 'Sagai and vivah rituals with muhurat consultation'],
      ['Griha Pravesh Add-on', 'Post-wedding first-entry ceremony at the couple’s home'],
    ],
  },
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);

const SURNAMES = [
  'Sharma', 'Verma', 'Kapoor', 'Mehta', 'Iyer', 'Reddy', 'Patel', 'Khan',
  'Joshi', 'Nair', 'Gupta', 'Malhotra', 'Chauhan', 'Bose', 'Desai', 'Agarwal',
  'Singh', 'Kulkarni', 'Rao', 'Pillai', 'Trivedi', 'Saxena', 'Bhatt', 'Menon',
];
const FIRST_F = ['Priya', 'Ananya', 'Kavya', 'Sneha', 'Pooja', 'Neha', 'Divya', 'Riya', 'Aishwarya', 'Meera', 'Shreya', 'Nandini', 'Isha', 'Tanvi', 'Aarti'];
const FIRST_M = ['Rahul', 'Arjun', 'Vikram', 'Rohan', 'Aditya', 'Karan', 'Siddharth', 'Nikhil', 'Amit', 'Varun', 'Harsh', 'Manish', 'Deepak', 'Sanjay', 'Ankur'];

// ── Vendors ──────────────────────────────────────────────────────────────────
// ~15 per city. Category mix is deliberately UNEVEN per city so /admin/gaps
// and the 6.5 density dashboard show real under-supply: each city rotates
// which two categories are starved (0–1 vendors) and which two are saturated.
const vendors = [];
const services = [];
const capacities = [];
const usedNames = new Set();
let vSeq = 0, sSeq = 0, cSeq = 0;

CITIES.forEach((city, ci) => {
  const starved = [CATEGORY_KEYS[ci % 10], CATEGORY_KEYS[(ci + 3) % 10]];
  const saturated = [CATEGORY_KEYS[(ci + 5) % 10], CATEGORY_KEYS[(ci + 7) % 10]];
  const cityPlan = [];
  for (const cat of CATEGORY_KEYS) {
    const n = starved.includes(cat) ? int(0, 1) : saturated.includes(cat) ? int(3, 4) : int(1, 2);
    for (let i = 0; i < n; i++) cityPlan.push(cat);
  }
  // Trim/pad to exactly 15 with common categories.
  while (cityPlan.length > 15) cityPlan.pop();
  while (cityPlan.length < 15) cityPlan.push(pick(['PHOTOGRAPHY', 'CATERING', 'DECORATION']));

  for (const cat of cityPlan) {
    vSeq += 1;
    const def = CATEGORIES[cat];
    let name = '';
    do {
      name = `${pick(SURNAMES)} ${pick(def.suffixes)}`;
    } while (usedNames.has(`${name}|${city.name}`));
    usedNames.add(`${name}|${city.name}`);

    const createdAt = NOW - int(60, 420) * DAY;
    const [pmin, pmax] = def.price;
    const priceMin = Math.round(between(pmin, pmin * 1.6) / 1000) * 1000;
    const priceMax = Math.round(between(priceMin * 1.5, pmax) / 1000) * 1000;
    const vendor = {
      id: uid(2, vSeq),
      userId: `demo-vendor-${String(vSeq).padStart(3, '0')}`,
      profileId: uid(1, vSeq),
      businessName: name,
      category: cat,
      city: city.name,
      state: city.state,
      verified: rnd() < 0.85,
      rating: (3.8 + rnd() * 1.1).toFixed(2),
      totalReviews: int(15, 450),
      yearsActive: int(2, 18),
      tagline: null,
      priceMin: `${priceMin}.00`,
      priceMax: `${priceMax}.00`,
      phone: `+9187770${hex(0x10000 + vSeq, 5)}`.slice(0, 13),
      // City-scoped domain: the same business name may exist in two cities,
      // and user.email is UNIQUE — a bare name-derived address would collide
      // and onConflictDoNothing would silently drop the second user row.
      email: `contact@${name.toLowerCase().replace(/[^a-z]+/g, '')}-${city.name.toLowerCase()}.example.in`,
      status: 'APPROVED',
      isActive: true,
      createdAt: iso(createdAt),
    };
    vendors.push(vendor);

    // Two services each, price bands nested inside the vendor's own band.
    const svcDefs = [...def.services].sort(() => rnd() - 0.5).slice(0, 2);
    for (const [svcName, svcDesc] of svcDefs) {
      sSeq += 1;
      const from = Math.round(between(priceMin, (priceMin + priceMax) / 2) / 500) * 500;
      services.push({
        id: uid(3, sSeq),
        vendorId: vendor.id,
        name: svcName,
        description: svcDesc,
        priceFrom: `${from}.00`,
        priceTo: `${Math.round(between(from, priceMax) / 500) * 500}.00`,
        isActive: true,
        createdAt: vendor.createdAt,
      });
    }

    // Capacity windows: Aug 2026 – Feb 2027; Mar–Sep windows are off-season
    // (mirrors the Oct–Feb peak convention in availabilityScorer).
    const windows = int(4, 8);
    for (let w = 0; w < windows; w++) {
      cSeq += 1;
      const start = Date.parse('2026-08-01T00:00:00Z') + int(0, 200) * DAY;
      const month = new Date(start).getUTCMonth() + 1;
      const maxBookings = int(1, 3);
      capacities.push({
        id: uid(4, cSeq),
        profileId: vendor.profileId,
        startAt: iso(start),
        endAt: iso(start + int(1, 3) * DAY),
        status: 'OPEN',
        maxBookings,
        bookedCount: int(0, Math.max(0, maxBookings - 1)),
        offSeason: month >= 3 && month <= 9,
      });
    }
  }
});

// ── Individual users (marketing audience) ────────────────────────────────────
// 50 users engineered to populate every launch segment:
//   idx  1–15  recently active (high-intent candidates)
//   idx 16–30  moderately active
//   idx 31–45  inactive 15–60d (win-back segment)
//   idx 46–50  brand-new (<48h) with incomplete profiles (welcome segment)
const users = [];
for (let i = 1; i <= 50; i++) {
  const female = rnd() < 0.5;
  const first = female ? pick(FIRST_F) : pick(FIRST_M);
  const last = pick(SURNAMES);
  const city = pick(CITIES);
  const band = i <= 15 ? 'active' : i <= 30 ? 'mid' : i <= 45 ? 'inactive' : 'new';
  const createdAt =
    band === 'new' ? NOW - int(2, 40) * 60 * 60 * 1000
                   : NOW - int(45, 300) * DAY;
  const lastActiveAt =
    band === 'active' ? NOW - int(0, 3) * DAY
    : band === 'mid' ? NOW - int(4, 12) * DAY
    : band === 'inactive' ? NOW - int(15, 60) * DAY
    : createdAt;
  users.push({
    id: `demo-user-${String(i).padStart(3, '0')}`,
    profileId: uid(7, i),
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@demo.smartshaadi.co.in`,
    phone: `+9187771${hex(0x10000 + i, 5)}`.slice(0, 13),
    gender: female ? 'FEMALE' : 'MALE',
    city: city.name,
    state: city.state,
    band,
    profileCompleteness: band === 'new' ? int(10, 35) : int(55, 98),
    marketingConsent: rnd() < 0.8,
    createdAt: iso(createdAt),
    lastActiveAt: iso(lastActiveAt),
  });
}

// ── Match requests (high-intent signal, last 7 days) ─────────────────────────
const matchRequests = [];
let mSeq = 0;
const activeUsers = users.filter((u) => u.band === 'active');
for (const u of activeUsers) {
  const n = int(2, 5);
  for (let k = 0; k < n; k++) {
    mSeq += 1;
    let other = pick(users);
    while (other.id === u.id) other = pick(users);
    matchRequests.push({
      id: uid(8, mSeq),
      senderId: u.profileId,
      receiverId: other.profileId,
      status: 'PENDING',
      createdAt: iso(NOW - int(0, 6) * DAY - int(1, 20) * 60 * 60 * 1000),
    });
  }
}

// ── Bookings + payments, Sep 2025 → Jul 2026, wedding-season weighted ────────
// Month weights create the seasonality the forecaster should find: the Nov–Feb
// muhurat season dominates, monsoon months are quiet.
const MONTH_WEIGHT = { 9: 1.0, 10: 1.6, 11: 3.0, 12: 3.2, 1: 2.8, 2: 2.4, 3: 1.2, 4: 1.4, 5: 1.2, 6: 0.7, 7: 0.6 };
const monthPool = [];
[[2025, 9], [2025, 10], [2025, 11], [2025, 12], [2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5], [2026, 6], [2026, 7]]
  .forEach(([y, m]) => {
    const w = Math.round(MONTH_WEIGHT[m] * 10);
    for (let k = 0; k < w; k++) monthPool.push([y, m]);
  });

const bookings = [];
const payments = [];
let bSeq = 0, pSeq = 0;
for (let i = 0; i < 200; i++) {
  bSeq += 1;
  const [y, m] = pick(monthPool);
  const eventMs = Date.parse(`${y}-${String(m).padStart(2, '0')}-01T00:00:00Z`) + int(0, 27) * DAY;
  const vendor = pick(vendors);
  const customer = pick(users);
  const amount = Math.round(between(Number(vendor.priceMin.slice(0, -3)), Number(vendor.priceMax.slice(0, -3))) / 500) * 500;
  const isPast = eventMs < NOW;
  const r = rnd();
  const status = isPast
    ? (r < 0.75 ? 'COMPLETED' : r < 0.9 ? 'CANCELLED' : r < 0.93 ? 'DISPUTED' : 'CONFIRMED')
    : (r < 0.6 ? 'CONFIRMED' : 'PENDING');
  const createdMs = Math.max(Date.parse('2025-09-01T00:00:00Z'), eventMs - int(30, 180) * DAY);
  const booking = {
    id: uid(5, bSeq),
    customerId: customer.id,
    vendorId: vendor.id,
    eventDate: iso(eventMs).slice(0, 10),
    ceremonyType: 'WEDDING',
    status,
    totalAmount: `${amount}.00`,
    guestCount: int(80, 900),
    eventLocation: `${vendor.city}`,
    createdAt: iso(createdMs),
  };
  bookings.push(booking);

  // Payment rows: advances for confirmed, full for completed, refunds for
  // half the cancellations. PENDING future bookings have no payment yet.
  if (status === 'COMPLETED' || status === 'CONFIRMED' || (status === 'CANCELLED' && rnd() < 0.5)) {
    pSeq += 1;
    const isAdvance = status === 'CONFIRMED';
    const payMs = createdMs + int(1, 5) * DAY;
    payments.push({
      id: uid(6, pSeq),
      bookingId: booking.id,
      amount: `${isAdvance ? Math.round(amount * 0.3 / 100) * 100 : amount}.00`,
      currency: 'INR',
      method: pick(['UPI', 'UPI', 'UPI', 'CARD', 'NETBANKING']),
      status: status === 'CANCELLED' ? 'REFUNDED' : 'CAPTURED',
      createdAt: iso(payMs),
      settledAt: status === 'CANCELLED' ? null : iso(payMs + 2 * DAY),
    });
  }
}

const dataset = {
  meta: {
    generator: 'build-demo-dataset.mjs',
    prngSeed: 20260718,
    anchor: iso(NOW),
    counts: {
      vendors: vendors.length,
      services: services.length,
      capacities: capacities.length,
      users: users.length,
      matchRequests: matchRequests.length,
      bookings: bookings.length,
      payments: payments.length,
    },
  },
  vendors, services, capacities, users, matchRequests, bookings, payments,
};

writeFileSync(OUT, `${JSON.stringify(dataset, null, 1)}\n`);
console.log('Wrote', OUT);
console.log(dataset.meta.counts);
