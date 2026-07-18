/**
 * Premium package supply seed — Phase 8, Unit 8.1.
 * packages/db/seed/premium-packages.ts
 *
 * Seeds FICTIONAL destination-venue supply so the packages feature works
 * end-to-end in production before any venue partnership is signed.
 *
 * ── Every business name here is invented ─────────────────────────────────────
 * No real hotel, palace, resort or company is named, and none is a play on one.
 * These rows ship to a live environment; borrowing a real brand would be a
 * trademark exposure on a page real users can open.
 *
 * ── is_placeholder = true on every row ───────────────────────────────────────
 * Internal provenance only. It does not hide, filter or down-rank anything —
 * these packages browse and render exactly like real supply. It gates exactly
 * one thing, in the service layer: they cannot be booked or paid for, because
 * no fictional venue can deliver a wedding. Enquiries stay open, which is the
 * entire reason to seed them. Onboarding a real venue is
 * `UPDATE ... SET is_placeholder = false` plus replacing the contact details
 * and imagery — no schema change and no re-keying.
 *
 * ── Idempotent ───────────────────────────────────────────────────────────────
 * Fixed sentinel UUIDs + onConflictDoNothing on every insert, matching
 * seed/vendors.ts. Re-running changes no row counts. Child collections
 * (inclusions, availability) are keyed on deterministic UUIDs too, so a re-run
 * cannot duplicate them.
 *
 * ── Cities ───────────────────────────────────────────────────────────────────
 * Destination cities are registered in the admin-managed `cities` registry
 * (Sprint J) with target_vendors_per_category = 0. A destination city has
 * venues, not a vendor roster, and the ops dashboard applies that target to
 * every city regardless of status — leaving the default of 3 would report a
 * permanent false under-supply gap. An operator who later decides to recruit
 * vendors there raises the number in /admin/cities.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import {
  user, vendors, cities,
  premiumPackages, premiumPackageInclusions, premiumPackageAvailability,
} from '../schema/index.js';

config({ path: resolve(__dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

// Deterministic UUID namespaces — 'd0' = destination supply, so these rows are
// recognisable as seed data at a glance in any query result.
const cityId    = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const venueId   = (n: number) => `d0000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const packageId = (n: number) => `d0000002-0000-4000-8000-${String(n).padStart(12, '0')}`;
const inclId    = (n: number) => `d0000003-0000-4000-8000-${String(n).padStart(12, '0')}`;
const availId   = (n: number) => `d0000004-0000-4000-8000-${String(n).padStart(12, '0')}`;

const venueUserId = (n: number) => `seed-venue-${String(n).padStart(3, '0')}`;

// ── Destination cities ───────────────────────────────────────────────────────
// PLANNED, not ACTIVE: these are venue destinations, not launched vendor
// markets. target 0 keeps them out of the density gap report.

interface SeedCity { n: number; name: string; state: string; lat: string; lon: string; order: number }

const DESTINATION_CITIES: SeedCity[] = [
  { n: 1, name: 'Udaipur',   state: 'Rajasthan',       lat: '24.585445', lon: '73.712479', order: 101 },
  { n: 2, name: 'Jodhpur',   state: 'Rajasthan',       lat: '26.238947', lon: '73.024309', order: 102 },
  { n: 3, name: 'Goa',       state: 'Goa',             lat: '15.299326', lon: '74.123996', order: 103 },
  { n: 4, name: 'Alibaug',   state: 'Maharashtra',     lat: '18.641400', lon: '72.872200', order: 104 },
  { n: 5, name: 'Kochi',     state: 'Kerala',          lat: '9.931233',  lon: '76.267303', order: 105 },
  { n: 6, name: 'Rishikesh', state: 'Uttarakhand',     lat: '30.086920', lon: '78.267899', order: 106 },
  { n: 7, name: 'Coorg',     state: 'Karnataka',       lat: '12.341900', lon: '75.808100', order: 107 },
  { n: 8, name: 'Shimla',    state: 'Himachal Pradesh',lat: '31.104814', lon: '77.173112', order: 108 },
];

// ── Venue vendors ────────────────────────────────────────────────────────────
// All names invented. Category VENUE — already present in vendorCategoryEnum.

interface SeedVenue {
  n: number; name: string; city: string; state: string;
  tagline: string; description: string;
  priceMin: string; priceMax: string; rating: string; reviews: number; years: number;
}

const VENUES: SeedVenue[] = [
  { n: 1, name: 'Amrit Haveli Retreat', city: 'Udaipur', state: 'Rajasthan',
    tagline: 'Lakeside courtyards and a restored stepwell',
    description: 'A restored merchant haveli on the eastern lake shore. Three linked courtyards host mehndi, sangeet and the pheras without moving guests off-site. Forty-two keys, all lake-facing.',
    priceMin: '850000.00', priceMax: '4200000.00', rating: '4.80', reviews: 96, years: 11 },
  { n: 2, name: 'Sarovar Ghat Palace', city: 'Udaipur', state: 'Rajasthan',
    tagline: 'Private ghat with baraat arrival by boat',
    description: 'Palace grounds with a private bathing ghat. The baraat arrives by decorated boat; the mandap sits on the water terrace. Capacity is genuinely capped at 300 for jetty safety.',
    priceMin: '1600000.00', priceMax: '7800000.00', rating: '4.90', reviews: 64, years: 18 },
  { n: 3, name: 'Marwar Sands Fort', city: 'Jodhpur', state: 'Rajasthan',
    tagline: 'Sandstone fort with desert-facing ramparts',
    description: 'A working heritage fort. Ceremonies run in the inner durbar; dinner is served on the ramparts. Dune camps for overflow guests sit fifteen minutes out.',
    priceMin: '980000.00', priceMax: '5100000.00', rating: '4.70', reviews: 78, years: 14 },
  { n: 4, name: 'Neelkanth Bagh Estate', city: 'Jodhpur', state: 'Rajasthan',
    tagline: 'Walled garden estate, blue-city views',
    description: 'Nine acres of walled orchard on the ridge, overlooking the old blue quarter. Marquee-based, so the layout adapts to guest counts between 150 and 700.',
    priceMin: '620000.00', priceMax: '2900000.00', rating: '4.60', reviews: 112, years: 9 },
  { n: 5, name: 'Saltwind Beach Resort', city: 'Goa', state: 'Goa',
    tagline: 'Beachfront lawn with sunset pheras',
    description: 'A quiet stretch of south-coast sand. The lawn seats 400 and the pheras are timed to sunset. Monsoon closure runs June to September.',
    priceMin: '540000.00', priceMax: '2600000.00', rating: '4.50', reviews: 143, years: 7 },
  { n: 6, name: 'Casa Verde Ribandar', city: 'Goa', state: 'Goa',
    tagline: 'Indo-Portuguese villa on the river',
    description: 'A restored eighteenth-century villa with a river-facing verandah. Intimate by design — sixty guests seated, ninety standing. Suits second-day brunches and small ceremonies.',
    priceMin: '310000.00', priceMax: '1250000.00', rating: '4.80', reviews: 58, years: 6 },
  { n: 7, name: 'Konkan Tide Villas', city: 'Alibaug', state: 'Maharashtra',
    tagline: 'Six private villas, one shared lawn',
    description: 'Six villas around a central lawn, taken as a whole property. Two hours from Mumbai by road or twenty minutes by ferry, which keeps a Mumbai guest list intact.',
    priceMin: '720000.00', priceMax: '3400000.00', rating: '4.70', reviews: 89, years: 8 },
  { n: 8, name: 'Backwater Serai Kumarakom', city: 'Kochi', state: 'Kerala',
    tagline: 'Backwater property with houseboat baraat',
    description: 'Lagoon-side lawns with traditional tharavad architecture. The baraat can arrive by houseboat convoy. Kerala-Sadya and North Indian kitchens both on site.',
    priceMin: '480000.00', priceMax: '2200000.00', rating: '4.60', reviews: 71, years: 10 },
  { n: 9, name: 'Ganga Ashram Grounds', city: 'Rishikesh', state: 'Uttarakhand',
    tagline: 'Riverside ceremony with evening aarti',
    description: 'River-terrace grounds for ceremonies that want the Ganga aarti as their evening. Strictly vegetarian and alcohol-free — a house rule, not a package option.',
    priceMin: '260000.00', priceMax: '980000.00', rating: '4.70', reviews: 54, years: 12 },
  { n: 10, name: 'Kaveri Mist Plantation', city: 'Coorg', state: 'Karnataka',
    tagline: 'Coffee estate with mist-line pavilion',
    description: 'A working coffee estate. The pavilion sits at the mist line; the plantation walk doubles as the photography route. Cool through the summer months.',
    priceMin: '390000.00', priceMax: '1650000.00', rating: '4.80', reviews: 66, years: 5 },
  { n: 11, name: 'Deodar Ridge Manor', city: 'Shimla', state: 'Himachal Pradesh',
    tagline: 'Colonial-era manor in cedar forest',
    description: 'A restored manor ringed by deodar. Indoor ballroom for 200, so the date does not depend on the weather. Road access can close in heavy January snow.',
    priceMin: '450000.00', priceMax: '1900000.00', rating: '4.50', reviews: 47, years: 15 },
  { n: 12, name: 'Pichola Terrace Gardens', city: 'Udaipur', state: 'Rajasthan',
    tagline: 'Tiered garden amphitheatre',
    description: 'Five stepped garden terraces working as a natural amphitheatre, so every guest sees the mandap without a screen. Largest terrace seats 600.',
    priceMin: '700000.00', priceMax: '3100000.00', rating: '4.60', reviews: 83, years: 6 },
];

// ── Packages ─────────────────────────────────────────────────────────────────

interface SeedPackage {
  n: number; venue: number; slug: string; title: string;
  tier: 'ESSENTIAL' | 'SIGNATURE' | 'LUXE';
  price: string; capMin: number; capMax: number; nights: number;
  summary: string; description: string;
  inclusions: string[]; exclusions: string[];
}

const PACKAGES: SeedPackage[] = [
  { n: 1, venue: 1, slug: 'amrit-haveli-lakeside-essential', title: 'Lakeside Essential', tier: 'ESSENTIAL',
    price: '850000.00', capMin: 60, capMax: 150, nights: 2,
    summary: 'Two nights, three courtyards, one ceremony day for an intimate guest list.',
    description: 'Covers the haveli exclusively for two nights with the pheras in the central courtyard. Suited to a guest list that fits in the property\'s own forty-two keys, so nobody is housed off-site.',
    inclusions: ['Exclusive use of all three courtyards for 2 nights', '42 lake-facing rooms on twin-share', 'Mehndi and sangeet setup with seating', 'Vegetarian and non-vegetarian buffet, 3 meals daily', 'Mandap structure with marigold and rose dressing', 'House sound system and uplighting', 'Dedicated wedding coordinator from booking'],
    exclusions: ['Photography and videography', 'Bridal hair, makeup and mehndi artist', 'Alcohol and bar service (licence arranged separately)', 'Guest travel to Udaipur', 'Priest and ritual materials', 'Fireworks or pyrotechnics'] },
  { n: 2, venue: 1, slug: 'amrit-haveli-stepwell-signature', title: 'Stepwell Signature', tier: 'SIGNATURE',
    price: '1850000.00', capMin: 120, capMax: 280, nights: 3,
    summary: 'Three nights across the full estate, with the restored stepwell as the sangeet stage.',
    description: 'Adds the restored stepwell as a dedicated sangeet venue and extends to three nights, giving haldi, mehndi, sangeet and the wedding day their own spaces rather than resetting one courtyard between functions.',
    inclusions: ['Exclusive estate use for 3 nights', 'All 42 rooms plus 30 partner rooms within 2km', 'Stepwell sangeet setup with stage and lighting rig', 'Four function meals daily including live counters', 'Premium floral across mandap, entrance and stepwell', 'Professional sound and DJ console', 'Golf-cart guest transfers within the estate', 'Welcome drinks and arrival hamper per room'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Udaipur', 'Priest and ritual materials'] },
  { n: 3, venue: 2, slug: 'sarovar-ghat-boat-baraat-luxe', title: 'Boat Baraat Luxe', tier: 'LUXE',
    price: '4900000.00', capMin: 150, capMax: 300, nights: 4,
    summary: 'Four nights, private ghat, and a baraat that arrives across the water.',
    description: 'The full palace for four nights. The baraat boards decorated boats at the far jetty and lands at the private ghat; the mandap is built on the water terrace. Capacity is genuinely capped at 300 by jetty safety limits, not by pricing.',
    inclusions: ['Exclusive palace use for 4 nights', '68 palace keys including 6 suites', 'Decorated boat baraat for up to 60 in the procession', 'Water-terrace mandap with structural build', 'Five function meals daily, four live kitchens', 'Full floral design across palace and ghat', 'Professional lighting, sound and stage crew', 'Guest concierge desk staffed 24 hours', 'Airport transfers for all guests', 'Choreographer for two sangeet rehearsals'],
    exclusions: ['Photography and videography', 'Bridal couture and styling', 'Alcohol (licence and stock arranged at cost)', 'Guest air travel to Udaipur', 'Priest and ritual materials', 'Drone permissions over the lake'] },
  { n: 4, venue: 3, slug: 'marwar-sands-durbar-signature', title: 'Durbar Signature', tier: 'SIGNATURE',
    price: '1650000.00', capMin: 100, capMax: 250, nights: 3,
    summary: 'Inner durbar ceremony, rampart dinner, dune camp for overflow guests.',
    description: 'Ceremonies in the fort\'s inner durbar hall and dinner along the ramparts as the desert light drops. Dune camps fifteen minutes out absorb guests beyond the fort\'s own room count.',
    inclusions: ['Exclusive fort use for 3 nights', '28 fort rooms plus 40 luxury dune tents', 'Inner durbar ceremony setup', 'Rampart dinner service with heaters', 'Four meals daily, Marwari and North Indian menus', 'Folk musicians and a Kalbeliya performance', 'Camel-drawn baraat carriage', 'Shuttle between fort and dune camp'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Jodhpur', 'Priest and ritual materials'] },
  { n: 5, venue: 4, slug: 'neelkanth-bagh-orchard-essential', title: 'Orchard Essential', tier: 'ESSENTIAL',
    price: '620000.00', capMin: 80, capMax: 200, nights: 2,
    summary: 'Marquee wedding in a walled orchard above the blue city.',
    description: 'Marquee-based, so the footprint scales with the guest list rather than forcing a fixed hall. Two nights on the estate with the old blue quarter as the backdrop.',
    inclusions: ['Walled orchard exclusive use for 2 nights', 'Marquee for up to 200 seated', '20 estate rooms on twin-share', 'Three meals daily, vegetarian and non-vegetarian', 'Mandap with seasonal floral dressing', 'Basic sound system and stage lighting', 'On-site coordinator'],
    exclusions: ['Guest accommodation beyond 20 rooms', 'Photography and videography', 'Bridal styling', 'Alcohol and bar service', 'Guest travel to Jodhpur', 'Priest and ritual materials'] },
  { n: 6, venue: 4, slug: 'neelkanth-bagh-ridge-signature', title: 'Ridge Signature', tier: 'SIGNATURE',
    price: '1450000.00', capMin: 200, capMax: 500, nights: 3,
    summary: 'The full nine acres, three nights, up to 500 guests.',
    description: 'Opens the whole estate across three nights with separate marquees for sangeet and the wedding, so neither function waits on the other being struck and reset.',
    inclusions: ['Full nine-acre estate for 3 nights', 'Separate sangeet and wedding marquees', '20 estate rooms plus 60 partner hotel rooms', 'Four meals daily with live counters', 'Full floral across both marquees and entrance', 'Professional sound, DJ and lighting rig', 'Guest shuttle to partner hotels', 'Welcome hampers per room'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Jodhpur', 'Priest and ritual materials'] },
  { n: 7, venue: 5, slug: 'saltwind-sunset-pheras-essential', title: 'Sunset Pheras Essential', tier: 'ESSENTIAL',
    price: '540000.00', capMin: 50, capMax: 160, nights: 2,
    summary: 'Beach lawn ceremony timed to sunset, two nights on the south coast.',
    description: 'The lawn opens onto the sand and the pheras are set against sunset. Note the June-to-September monsoon closure — those dates are blocked on this package rather than sold and cancelled.',
    inclusions: ['Beach lawn exclusive use for 2 nights', '30 sea-view rooms on twin-share', 'Sunset-timed mandap on the lawn', 'Three meals daily including a seafood counter', 'Beach bonfire and acoustic set', 'Sound system and festoon lighting', 'On-site coordinator'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Goa', 'Priest and ritual materials', 'Water sports and boat hire'] },
  { n: 8, venue: 5, slug: 'saltwind-shoreline-signature', title: 'Shoreline Signature', tier: 'SIGNATURE',
    price: '1380000.00', capMin: 150, capMax: 400, nights: 3,
    summary: 'Whole-resort buyout with a beach sangeet and a lawn wedding.',
    description: 'Full resort buyout across three nights, splitting the sangeet onto the sand and the wedding onto the lawn so the two never share a reset.',
    inclusions: ['Full resort buyout for 3 nights', 'All 78 rooms including 8 suites', 'Beach sangeet with stage and rigging', 'Lawn wedding setup with premium floral', 'Four meals daily, four cuisines', 'Professional DJ and lighting crew', 'Airport transfers from Goa airport', 'Poolside welcome brunch'],
    exclusions: ['Photography and videography', 'Bridal couture and styling', 'Alcohol and bar service', 'Guest air travel', 'Priest and ritual materials'] },
  { n: 9, venue: 6, slug: 'casa-verde-verandah-essential', title: 'Verandah Essential', tier: 'ESSENTIAL',
    price: '310000.00', capMin: 20, capMax: 60, nights: 2,
    summary: 'A sixty-guest villa wedding on the river verandah.',
    description: 'Deliberately small. Sixty seated on the verandah, ninety standing. Suits an intimate ceremony or a second-day brunch rather than a full baraat.',
    inclusions: ['Exclusive villa use for 2 nights', '9 heritage rooms', 'Verandah ceremony setup', 'Three meals daily, Goan and continental', 'Floral dressing across verandah and courtyard', 'Acoustic musician for the ceremony', 'On-site host'],
    exclusions: ['Guest accommodation beyond 9 rooms', 'Photography and videography', 'Bridal styling', 'Alcohol and bar service', 'Guest travel to Goa', 'Priest and ritual materials'] },
  { n: 10, venue: 7, slug: 'konkan-tide-villa-signature', title: 'Villa Cluster Signature', tier: 'SIGNATURE',
    price: '1250000.00', capMin: 80, capMax: 220, nights: 3,
    summary: 'Six villas taken whole, two hours from Mumbai.',
    description: 'All six villas and the shared lawn for three nights. Close enough to Mumbai that a city guest list stays intact — road or ferry, both under two hours.',
    inclusions: ['All 6 villas plus central lawn for 3 nights', '36 rooms across the villas', 'Lawn mandap with full floral', 'Four meals daily, Konkan and North Indian', 'Poolside sangeet setup', 'Sound, lighting and DJ console', 'Ferry coordination from Mumbai', 'Welcome hampers per villa'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Alibaug', 'Priest and ritual materials'] },
  { n: 11, venue: 8, slug: 'backwater-serai-houseboat-signature', title: 'Houseboat Baraat Signature', tier: 'SIGNATURE',
    price: '1150000.00', capMin: 100, capMax: 260, nights: 3,
    summary: 'Lagoon-side ceremony with a houseboat baraat convoy.',
    description: 'Three nights on the lagoon, with the baraat arriving as a houseboat convoy. Both a Kerala-Sadya kitchen and a North Indian kitchen run on site, so a mixed guest list is fed properly.',
    inclusions: ['Lagoon property exclusive use for 3 nights', '34 rooms including 4 lagoon villas', 'Houseboat baraat convoy for up to 50', 'Lagoon-side mandap with tropical floral', 'Four meals daily, Sadya and North Indian kitchens', 'Kathakali and Chenda melam performance', 'Backwater sunset cruise for all guests', 'Airport transfers from Kochi'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest air travel to Kochi', 'Priest and ritual materials'] },
  { n: 12, venue: 9, slug: 'ganga-ashram-aarti-essential', title: 'Riverside Aarti Essential', tier: 'ESSENTIAL',
    price: '260000.00', capMin: 40, capMax: 120, nights: 2,
    summary: 'River-terrace ceremony with the evening Ganga aarti.',
    description: 'Two nights on the river terrace, with the ceremony timed so the Ganga aarti becomes the evening. Strictly vegetarian and alcohol-free — a house rule, stated up front rather than discovered late.',
    inclusions: ['River terrace exclusive use for 2 nights', '24 riverside rooms on twin-share', 'Ceremony setup on the terrace', 'Three vegetarian meals daily', 'Evening Ganga aarti participation', 'Morning yoga and meditation sessions', 'Resident priest for the ceremony'],
    exclusions: ['Any alcohol — the property is dry', 'Non-vegetarian catering of any kind', 'Photography and videography', 'Bridal styling', 'Guest travel to Rishikesh', 'Amplified music after 22:00'] },
  { n: 13, venue: 10, slug: 'kaveri-mist-plantation-essential', title: 'Plantation Essential', tier: 'ESSENTIAL',
    price: '390000.00', capMin: 40, capMax: 130, nights: 2,
    summary: 'Coffee-estate pavilion at the mist line.',
    description: 'Two nights on a working coffee estate, ceremony in the mist-line pavilion. Stays cool through the summer months when the plains do not.',
    inclusions: ['Estate pavilion and gardens for 2 nights', '22 plantation cottages', 'Pavilion ceremony setup', 'Three meals daily, Coorgi and North Indian', 'Guided plantation walk and coffee tasting', 'Bonfire evening with local musicians', 'On-site coordinator'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Coorg', 'Priest and ritual materials'] },
  { n: 14, venue: 10, slug: 'kaveri-mist-canopy-luxe', title: 'Canopy Luxe', tier: 'LUXE',
    price: '2650000.00', capMin: 100, capMax: 200, nights: 4,
    summary: 'Four nights, full estate, and a canopy build above the coffee line.',
    description: 'The whole estate for four nights with a purpose-built canopy structure above the coffee line. Capped at 200 — the estate roads cannot move more guests than that comfortably.',
    inclusions: ['Full estate exclusive use for 4 nights', 'All 22 cottages plus 18 luxury tents', 'Elevated canopy structure above the plantation', 'Five meals daily with four live kitchens', 'Full floral and lighting design', 'Live band and DJ across three evenings', 'Spa treatments for the couple and both families', 'Estate 4x4 transfers throughout', 'Bangalore airport transfers for all guests'],
    exclusions: ['Photography and videography', 'Bridal couture and styling', 'Alcohol and bar service', 'Guest air travel', 'Priest and ritual materials'] },
  { n: 15, venue: 11, slug: 'deodar-ridge-ballroom-signature', title: 'Cedar Ballroom Signature', tier: 'SIGNATURE',
    price: '1100000.00', capMin: 80, capMax: 200, nights: 3,
    summary: 'Indoor ballroom wedding — the date does not depend on weather.',
    description: 'Three nights at the manor with the ceremony indoors in the ballroom, which is the point: a hill wedding whose date is not hostage to the forecast. January road access can close in heavy snow, and those dates are blocked.',
    inclusions: ['Manor exclusive use for 3 nights', '26 rooms with fireplaces', 'Indoor ballroom ceremony for up to 200', 'Four meals daily, Himachali and North Indian', 'Heated marquee for the sangeet', 'Sound and stage lighting', 'Bonfire evenings with local musicians', 'Shimla station transfers'],
    exclusions: ['Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Shimla', 'Priest and ritual materials', 'Snow-clearance guarantees on approach roads'] },
  { n: 16, venue: 12, slug: 'pichola-terrace-amphitheatre-signature', title: 'Terrace Amphitheatre Signature', tier: 'SIGNATURE',
    price: '1550000.00', capMin: 200, capMax: 600, nights: 3,
    summary: 'Five stepped terraces so every guest sees the mandap unscreened.',
    description: 'The tiered gardens work as a natural amphitheatre — at 600 guests nobody is watching a screen, which is the usual failure of a wedding at this size.',
    inclusions: ['All five garden terraces for 3 nights', '48 partner hotel rooms within 3km', 'Amphitheatre mandap on the lowest terrace', 'Four meals daily across two service points', 'Full floral across all five terraces', 'Professional sound with terrace-wide coverage', 'Guest shuttle to partner hotels', 'Golf carts between terraces'],
    exclusions: ['On-site accommodation (all rooms are partner hotels)', 'Photography and videography', 'Bridal styling and mehndi artist', 'Alcohol and bar service', 'Guest travel to Udaipur', 'Priest and ritual materials'] },
  { n: 17, venue: 2, slug: 'sarovar-ghat-terrace-signature', title: 'Water Terrace Signature', tier: 'SIGNATURE',
    price: '2400000.00', capMin: 100, capMax: 220, nights: 3,
    summary: 'The water terrace and palace wing, without the boat baraat build.',
    description: 'Three nights on the water terrace and one palace wing. The same setting as the Luxe package without the boat procession, for a guest list that does not need the full jetty operation.',
    inclusions: ['Water terrace and east wing for 3 nights', '34 palace keys', 'Water-terrace mandap', 'Four meals daily, three live kitchens', 'Full floral across terrace and wing', 'Professional sound and lighting', 'Airport transfers for all guests'],
    exclusions: ['Boat baraat procession (see Boat Baraat Luxe)', 'Photography and videography', 'Bridal couture and styling', 'Alcohol and bar service', 'Guest air travel', 'Priest and ritual materials'] },
  { n: 18, venue: 3, slug: 'marwar-sands-dune-luxe', title: 'Desert Dune Luxe', tier: 'LUXE',
    price: '3800000.00', capMin: 120, capMax: 260, nights: 4,
    summary: 'Fort ceremony, dune reception under open sky.',
    description: 'Four nights split between the fort and the dunes — ceremonies inside the durbar, the reception staged out on the sand under open sky with a full lighting build.',
    inclusions: ['Fort and dune camp exclusive use for 4 nights', '28 fort rooms plus 60 luxury dune tents', 'Durbar ceremony and dune reception builds', 'Five meals daily across both sites', 'Full desert lighting and sound rig', 'Camel and horse baraat procession', 'Folk troupe performances across three evenings', 'Jodhpur airport transfers for all guests', 'Hot-air balloon sunrise for the couple'],
    exclusions: ['Photography and videography', 'Bridal couture and styling', 'Alcohol and bar service', 'Guest air travel to Jodhpur', 'Priest and ritual materials', 'Balloon flight in unsafe wind conditions'] },
  { n: 19, venue: 7, slug: 'konkan-tide-monsoon-essential', title: 'Monsoon Villa Essential', tier: 'ESSENTIAL',
    price: '480000.00', capMin: 30, capMax: 90, nights: 2,
    summary: 'Two villas, ninety guests, green-season pricing.',
    description: 'Two of the six villas for a smaller ceremony at green-season rates. Covered pavilion so rain changes the mood rather than the plan.',
    inclusions: ['2 villas plus covered pavilion for 2 nights', '12 rooms', 'Covered pavilion ceremony setup', 'Three meals daily', 'Indoor sangeet with sound system', 'Ferry coordination from Mumbai'],
    exclusions: ['The remaining 4 villas and central lawn', 'Photography and videography', 'Bridal styling', 'Alcohol and bar service', 'Guest travel to Alibaug', 'Priest and ritual materials'] },
  { n: 20, venue: 8, slug: 'backwater-serai-lagoon-essential', title: 'Lagoon Essential', tier: 'ESSENTIAL',
    price: '480000.00', capMin: 40, capMax: 140, nights: 2,
    summary: 'Lagoon-side ceremony without the houseboat convoy.',
    description: 'Two nights lagoon-side for a smaller guest list, with the same Sadya kitchen but without the houseboat baraat build.',
    inclusions: ['Lagoon lawns for 2 nights', '20 rooms on twin-share', 'Lagoon-side mandap', 'Three meals daily, Sadya and North Indian', 'Evening backwater cruise', 'Sound system and festoon lighting'],
    exclusions: ['Houseboat baraat convoy', 'Photography and videography', 'Bridal styling', 'Alcohol and bar service', 'Guest travel to Kochi', 'Priest and ritual materials'] },
  { n: 21, venue: 1, slug: 'amrit-haveli-courtyard-luxe', title: 'Courtyard Luxe', tier: 'LUXE',
    price: '3200000.00', capMin: 100, capMax: 180, nights: 4,
    summary: 'Four nights, whole haveli, one function per courtyard per day.',
    description: 'The whole haveli for four nights with a dedicated courtyard per function per day — nothing is struck and reset while guests are on site.',
    inclusions: ['Whole haveli for 4 nights', 'All 42 rooms plus 24 partner rooms', 'A dedicated courtyard per function', 'Five meals daily, four live kitchens', 'Full floral and lighting design throughout', 'Live band, DJ and folk troupe', 'Couple and family spa treatments', 'Udaipur airport transfers for all guests', 'Dedicated planner from booking to departure'],
    exclusions: ['Photography and videography', 'Bridal couture and styling', 'Alcohol and bar service', 'Guest air travel', 'Priest and ritual materials'] },
  { n: 22, venue: 12, slug: 'pichola-terrace-intimate-essential', title: 'Upper Terrace Essential', tier: 'ESSENTIAL',
    price: '700000.00', capMin: 60, capMax: 180, nights: 2,
    summary: 'The two upper terraces for a smaller ceremony.',
    description: 'The two highest terraces only — the best lake views of the five, sized for a guest list under 180.',
    inclusions: ['Two upper terraces for 2 nights', '24 partner hotel rooms within 3km', 'Upper-terrace mandap with floral', 'Three meals daily', 'Sound system and terrace lighting', 'Guest shuttle to partner hotels'],
    exclusions: ['The three lower terraces', 'On-site accommodation', 'Photography and videography', 'Bridal styling', 'Alcohol and bar service', 'Guest travel to Udaipur'] },
  { n: 23, venue: 6, slug: 'casa-verde-river-brunch-essential', title: 'River Brunch Essential', tier: 'ESSENTIAL',
    price: '180000.00', capMin: 20, capMax: 60, nights: 1,
    summary: 'A single-night, sixty-guest brunch or roka.',
    description: 'One night for a roka, engagement or post-wedding brunch. The smallest thing on the platform, and deliberately so — not every function needs a four-day build.',
    inclusions: ['Villa and verandah for 1 night', '9 heritage rooms', 'Brunch service on the verandah', 'Floral dressing on verandah and courtyard', 'Acoustic musician'],
    exclusions: ['Multi-day functions', 'Guest accommodation beyond 9 rooms', 'Photography and videography', 'Alcohol and bar service', 'Guest travel to Goa'] },
  { n: 24, venue: 9, slug: 'ganga-ashram-sunrise-essential', title: 'Sunrise Vows Essential', tier: 'ESSENTIAL',
    price: '320000.00', capMin: 30, capMax: 100, nights: 2,
    summary: 'Dawn ceremony on the river terrace.',
    description: 'A dawn-timed ceremony rather than the evening aarti slot, for couples who want the river at first light. Same house rules apply: vegetarian and dry.',
    inclusions: ['River terrace for 2 nights', '24 riverside rooms', 'Dawn ceremony setup with fire ritual', 'Three vegetarian meals daily', 'Morning yoga and meditation', 'Resident priest for the ceremony', 'Evening satsang'],
    exclusions: ['Any alcohol — the property is dry', 'Non-vegetarian catering of any kind', 'Photography and videography', 'Bridal styling', 'Guest travel to Rishikesh', 'Amplified music at any hour'] },
];

// Seasonal closures. Real constraints for these geographies, so the availability
// UI has something meaningful to render rather than an empty list.
const AVAILABILITY: Array<{ n: number; pkg: number; from: string; to: string; reason: string }> = [
  { n: 1, pkg: 7,  from: '2026-06-01', to: '2026-09-30', reason: 'Monsoon closure — beach lawn unusable' },
  { n: 2, pkg: 8,  from: '2026-06-01', to: '2026-09-30', reason: 'Monsoon closure — beach lawn unusable' },
  { n: 3, pkg: 15, from: '2027-01-05', to: '2027-02-10', reason: 'Heavy snow — approach road access not guaranteed' },
  { n: 4, pkg: 18, from: '2026-05-01', to: '2026-07-15', reason: 'Desert summer — dune camp closed above 45C' },
  { n: 5, pkg: 4,  from: '2026-05-01', to: '2026-07-15', reason: 'Desert summer — rampart dining closed' },
  { n: 6, pkg: 11, from: '2026-06-15', to: '2026-08-31', reason: 'Monsoon — lagoon levels unsafe for houseboat convoy' },
  { n: 7, pkg: 14, from: '2026-06-01', to: '2026-08-15', reason: 'Monsoon — estate roads impassable' },
  { n: 8, pkg: 3,  from: '2026-07-01', to: '2026-08-31', reason: 'Monsoon — jetty operations suspended' },
];

export async function seedPremiumPackages(): Promise<void> {
  // ── 1. Register destination cities ─────────────────────────────────────────
  for (const c of DESTINATION_CITIES) {
    await db.insert(cities).values({
      id:     cityId(c.n),
      name:   c.name,
      slug:   c.name.toLowerCase().replace(/\s+/g, '-'),
      state:  c.state,
      // PLANNED, not ACTIVE: a venue destination is not a launched vendor market.
      status: 'PLANNED',
      // 0, not the default 3 — see the header note. A destination city has
      // venues, not a vendor roster, and the ops dashboard would otherwise
      // report a permanent false under-supply gap.
      targetVendorsPerCategory: 0,
      latitude:  c.lat,
      longitude: c.lon,
      displayOrder: c.order,
    }).onConflictDoNothing();
  }

  // ── 2. Venue owner user accounts ───────────────────────────────────────────
  // vendors.user_id is a unique NOT NULL FK, so each venue needs one. These are
  // real login-capable rows; credentials are never set, so nobody can sign in as
  // them until a real venue partner is onboarded and given a password reset.
  for (const v of VENUES) {
    await db.insert(user).values({
      id:    venueUserId(v.n),
      name:  v.name,
      // .invalid is reserved by RFC 2606 and can never be registered, so a stray
      // notification to a seeded venue cannot reach a real inbox.
      email: `venue-${v.n}@seed.invalid`,
      emailVerified: false,
      role:   'VENDOR',
      status: 'ACTIVE',
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  // ── 3. Venue vendor records ────────────────────────────────────────────────
  for (const v of VENUES) {
    await db.insert(vendors).values({
      id:           venueId(v.n),
      userId:       venueUserId(v.n),
      businessName: v.name,
      category:     'VENUE',
      city:         v.city,
      state:        v.state,
      verified:     true,
      rating:       v.rating,
      totalReviews: v.reviews,
      isActive:     true,
      tagline:      v.tagline,
      description:  v.description,
      yearsActive:  v.years,
      priceMin:     v.priceMin,
      priceMax:     v.priceMax,
      status:       'APPROVED',
      // The provenance marker. Everything above renders exactly as a real
      // vendor; this is the only field that says otherwise.
      isPlaceholder: true,
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  // ── 4. Packages ────────────────────────────────────────────────────────────
  const heroFor = (tier: string) => `/seed/package-${tier.toLowerCase()}.svg`;

  for (const p of PACKAGES) {
    const venue = VENUES.find((v) => v.n === p.venue);
    if (!venue) throw new Error(`Seed error: package ${p.slug} references unknown venue ${p.venue}`);
    const city = DESTINATION_CITIES.find((c) => c.name === venue.city);

    await db.insert(premiumPackages).values({
      id:       packageId(p.n),
      vendorId: venueId(p.venue),
      slug:     p.slug,
      title:    p.title,
      tier:     p.tier,
      destinationCity: venue.city,
      // Linked at seed time rather than left to the 0039 backfill, so the link
      // exists even on a database seeded before that migration's UPDATE ran.
      cityId:   city ? cityId(city.n) : null,
      countryCode: 'IN',
      priceFrom:   p.price,
      currency:    'INR',
      guestCapacityMin: p.capMin,
      guestCapacityMax: p.capMax,
      durationNights:   p.nights,
      summary:      p.summary,
      description:  p.description,
      heroImageUrl: heroFor(p.tier),
      isPlaceholder: true,
      isActive:      true,
      sortOrder:     p.n,
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  // ── 5. Inclusions and exclusions ───────────────────────────────────────────
  // Deterministic ids from a running counter so a re-run overwrites nothing and
  // duplicates nothing.
  let counter = 0;
  for (const p of PACKAGES) {
    for (const [i, label] of p.inclusions.entries()) {
      await db.insert(premiumPackageInclusions).values({
        id: inclId(++counter), packageId: packageId(p.n),
        kind: 'INCLUSION', label, sortOrder: i,
      }).onConflictDoNothing();
    }
    for (const [i, label] of p.exclusions.entries()) {
      await db.insert(premiumPackageInclusions).values({
        id: inclId(++counter), packageId: packageId(p.n),
        kind: 'EXCLUSION', label, sortOrder: i,
      }).onConflictDoNothing();
    }
  }

  // ── 6. Seasonal closures ───────────────────────────────────────────────────
  for (const a of AVAILABILITY) {
    await db.insert(premiumPackageAvailability).values({
      id: availId(a.n), packageId: packageId(a.pkg),
      blockedFrom: a.from, blockedTo: a.to, reason: a.reason,
    }).onConflictDoNothing();
  }

  console.log(
    `  ✓ 8.1 supply: ${DESTINATION_CITIES.length} cities, ${VENUES.length} venues, `
    + `${PACKAGES.length} packages, ${counter} inclusion lines, `
    + `${AVAILABILITY.length} closures (all is_placeholder = true)`,
  );
}

// Allow running this seed on its own: `tsx seed/premium-packages.ts`
if (process.argv[1]?.includes('premium-packages')) {
  seedPremiumPackages()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error('❌ 8.1 seed failed:', e); process.exit(1); });
}
