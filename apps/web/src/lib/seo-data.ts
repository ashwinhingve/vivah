/**
 * SEO data registry for programmatic landing pages.
 * Used by /[slug] catch-all + sitemap.ts to generate static pages at build time.
 */

export interface Community {
  slug:        string;          // 'hindu' → URL becomes /hindu-matrimony
  label:       string;          // 'Hindu'
  description: string;          // long-form intro for the page
  highlights:  string[];        // bullet points
}

export interface City {
  slug:        string;          // 'bhopal' → URL becomes /marriages-in-bhopal
  label:       string;          // 'Bhopal'
  state:       string;          // 'Madhya Pradesh'
  description: string;
  highlights:  string[];
}

export interface Caste {
  slug:        string;          // 'brahmin' → URL becomes /brahmin-marriage-bureau
  label:       string;          // 'Brahmin'
  description: string;
  highlights:  string[];
}

// ── Communities ──────────────────────────────────────────────────────────────

export const COMMUNITIES: Community[] = [
  {
    slug:  'hindu',
    label: 'Hindu',
    description:
      'Hindu matrimonial matchmaking with Vedic Guna Milan compatibility scoring, ' +
      'Manglik dosha analysis, and full Ashtakoot Kundli matching. Find a life partner ' +
      'from your gotra, sub-community, or pan-India Hindu families.',
    highlights: [
      'Full 36-point Ashtakoot Guna Milan score',
      'Manglik dosha detection and compatibility check',
      'Filter by gotra, sub-community, regional roots',
      'Verified Hindu families across India',
    ],
  },
  {
    slug:  'muslim',
    label: 'Muslim',
    description:
      'Muslim matrimony built around Islamic values — Sunni, Shia, and inter-sect ' +
      'compatibility. Privacy-first profiles with optional photo masking, family-led ' +
      'introductions, and verified backgrounds.',
    highlights: [
      'Sunni, Shia, and sect-flexible matching',
      'Hijab and modesty preference filters',
      'Family-introduction workflow',
      'Verified Muslim families across India',
    ],
  },
  {
    slug:  'sikh',
    label: 'Sikh',
    description:
      'Sikh matrimonial platform for families across Punjab, Delhi, and the global ' +
      'diaspora. Match by sub-community (Jat, Khatri, Ramgarhia, Arora), Anand Karaj ' +
      'preferences, and Gurudwara involvement.',
    highlights: [
      'Sub-community filters: Jat, Khatri, Ramgarhia, Arora',
      'Amritdhari and keshdhari preferences',
      'Family-rooted matching workflow',
      'Verified Sikh families across India + diaspora',
    ],
  },
  {
    slug:  'jain',
    label: 'Jain',
    description:
      'Jain matrimony covering Digambara, Shvetambara, and sub-community filters ' +
      'such as Oswal, Porwal, Agarwal, and Mahesh. Pure-vegetarian and Jain-dietary ' +
      'compatible profiles.',
    highlights: [
      'Digambara and Shvetambara compatibility',
      'Sub-community filters: Oswal, Porwal, Agarwal',
      'Strict Jain dietary preference matching',
      'Verified Jain families across India',
    ],
  },
  {
    slug:  'christian',
    label: 'Christian',
    description:
      'Christian matrimonial matchmaking for Catholic, Protestant, Orthodox, and ' +
      'denomination-flexible families. Faith-strength compatibility, language ' +
      'preferences, and verified introductions.',
    highlights: [
      'Catholic, Protestant, and Orthodox matching',
      'Faith-strength compatibility scoring',
      'Language and regional roots filters',
      'Verified Christian families across India',
    ],
  },
  {
    slug:  'buddhist',
    label: 'Buddhist',
    description:
      'Buddhist matrimonial platform for Theravada, Mahayana, and Vajrayana ' +
      'families. Cultural and meditation-practice compatibility, plus regional ' +
      'and language filters.',
    highlights: [
      'Theravada, Mahayana, and Vajrayana matching',
      'Meditation and practice compatibility',
      'Regional and language filters',
      'Verified Buddhist families across India',
    ],
  },
];

// ── Cities ───────────────────────────────────────────────────────────────────

export const CITIES: City[] = [
  {
    slug:  'bhopal',
    label: 'Bhopal',
    state: 'Madhya Pradesh',
    description:
      'Smart Shaadi connects families in Bhopal and across Madhya Pradesh — old-city ' +
      'roots, MP Nagar professionals, and Hoshangabad-Bhopal Road residents. AI-led ' +
      'compatibility, Guna Milan, and family-first introductions.',
    highlights: [
      'Old Bhopal and new Bhopal family networks',
      'MP Nagar, Arera Colony, Kolar Road professionals',
      'Cross-MP matching: Indore, Jabalpur, Gwalior',
      'Verified profiles with KYC',
    ],
  },
  {
    slug:  'delhi',
    label: 'Delhi',
    state: 'Delhi NCR',
    description:
      'Delhi matrimony covering NCR — Gurgaon, Noida, Faridabad, Ghaziabad, and ' +
      'central Delhi. Cosmopolitan match pool with regional, linguistic, and ' +
      'community compatibility.',
    highlights: [
      'Pan-NCR coverage: Delhi, Gurgaon, Noida, Faridabad',
      'Punjabi, UP, Bihari, South Indian sub-communities',
      'High-income professional matching',
      'Verified Delhi families with strict KYC',
    ],
  },
  {
    slug:  'mumbai',
    label: 'Mumbai',
    state: 'Maharashtra',
    description:
      'Mumbai matrimonial platform for Mumbai, Navi Mumbai, and Thane families — ' +
      'Marathi, Gujarati, South Indian, and pan-India communities. AI-curated ' +
      'matches with privacy controls.',
    highlights: [
      'Mumbai, Navi Mumbai, Thane coverage',
      'Marathi, Gujarati, South Indian community matching',
      'High-rise professional family network',
      'Verified Mumbai families with KYC',
    ],
  },
  {
    slug:  'bangalore',
    label: 'Bangalore',
    state: 'Karnataka',
    description:
      'Bangalore (Bengaluru) matrimony for Kannada, Tamil, Telugu, Malayali, and ' +
      'pan-India tech families. AI compatibility tuned for cosmopolitan and ' +
      'tech-professional matching.',
    highlights: [
      'Kannada, Tamil, Telugu, Malayali community matching',
      'Tech-professional and startup families',
      'Whitefield, Koramangala, Indiranagar coverage',
      'Verified Bangalore families with strict KYC',
    ],
  },
  {
    slug:  'jaipur',
    label: 'Jaipur',
    state: 'Rajasthan',
    description:
      'Jaipur matrimonial matchmaking for Rajasthani families — Rajput, Brahmin, ' +
      'Marwari, Jain, and Agarwal communities. Tradition-respecting AI with full ' +
      'Guna Milan scoring.',
    highlights: [
      'Rajput, Marwari, Jain, Agarwal sub-communities',
      'Pan-Rajasthan coverage: Jodhpur, Udaipur, Kota',
      'Traditional family-first introductions',
      'Verified Jaipur families with KYC',
    ],
  },
  {
    slug:  'pune',
    label: 'Pune',
    state: 'Maharashtra',
    description:
      'Pune matrimony for Marathi Brahmin, Maratha, Marwari, and pan-India tech ' +
      'and student families. AI-driven compatibility, tradition-rooted profiles.',
    highlights: [
      'Marathi Brahmin and Maratha matching',
      'Tech-professional and student family network',
      'Koregaon Park, Kothrud, Hadapsar coverage',
      'Verified Pune families with KYC',
    ],
  },
  {
    slug:  'hyderabad',
    label: 'Hyderabad',
    state: 'Telangana',
    description:
      'Hyderabad matrimonial platform for Telugu, Andhra, Muslim, Marwari, and ' +
      'tech-professional families across Hyderabad, Secunderabad, and Cyberabad.',
    highlights: [
      'Telugu, Andhra, Marwari, Muslim community matching',
      'Cyberabad and HITEC City professional families',
      'Old City and new city coverage',
      'Verified Hyderabad families with KYC',
    ],
  },
  {
    slug:  'indore',
    label: 'Indore',
    state: 'Madhya Pradesh',
    description:
      'Indore matrimony for Marwari, Jain, Maharashtrian, and Sindhi families — ' +
      'India\'s commercial capital of MP. Full Guna Milan scoring and family-led ' +
      'matchmaking.',
    highlights: [
      'Marwari, Jain, Maharashtrian, Sindhi matching',
      'Commercial and business family networks',
      'Vijay Nagar, Palasia, Bhawarkuan coverage',
      'Verified Indore families with KYC',
    ],
  },
  {
    slug:  'lucknow',
    label: 'Lucknow',
    state: 'Uttar Pradesh',
    description:
      'Lucknow matrimonial matchmaking for Kayastha, Brahmin, Muslim (Shia and ' +
      'Sunni), and Sindhi families. Tehzeeb-rich AI matching with cultural ' +
      'compatibility.',
    highlights: [
      'Kayastha, Brahmin, Shia, Sunni community matching',
      'Pan-UP coverage with cultural compatibility',
      'Gomti Nagar, Hazratganj, Aliganj coverage',
      'Verified Lucknow families with KYC',
    ],
  },
  {
    slug:  'ahmedabad',
    label: 'Ahmedabad',
    state: 'Gujarat',
    description:
      'Ahmedabad matrimony for Gujarati, Jain, Patel, Brahmin, and Marwari ' +
      'business and professional families. Pan-Gujarat coverage with full Guna ' +
      'Milan scoring.',
    highlights: [
      'Gujarati Patel, Jain, Brahmin community matching',
      'Pan-Gujarat coverage: Surat, Vadodara, Rajkot',
      'Business and professional family networks',
      'Verified Ahmedabad families with KYC',
    ],
  },
];

// ── Castes ───────────────────────────────────────────────────────────────────

export const CASTES: Caste[] = [
  {
    slug:  'brahmin',
    label: 'Brahmin',
    description:
      'Brahmin marriage bureau covering Iyer, Iyengar, Saraswat, Smartha, Kashmiri ' +
      'Pandit, Maithil, Gaur, Sanadya, and pan-India Brahmin sub-communities. Full ' +
      'Guna Milan with gotra-exogamy filters.',
    highlights: [
      'Iyer, Iyengar, Saraswat, Kashmiri Pandit matching',
      'Gotra-exogamy filters built-in',
      'Vedic Guna Milan and Manglik analysis',
      'Verified Brahmin families across India',
    ],
  },
  {
    slug:  'rajput',
    label: 'Rajput',
    description:
      'Rajput marriage bureau for Suryavanshi, Chandravanshi, Agnivanshi clans ' +
      '— Sisodia, Rathore, Chauhan, Kachwaha, Tomar, and more. Tradition-first AI ' +
      'with full gotra and kul compatibility.',
    highlights: [
      'Suryavanshi, Chandravanshi, Agnivanshi clan filters',
      'Gotra-exogamy and kul compatibility',
      'Pan-North India coverage',
      'Verified Rajput families with KYC',
    ],
  },
  {
    slug:  'jain',
    label: 'Jain',
    description:
      'Jain marriage bureau for Digambara, Shvetambara, Oswal, Porwal, Agarwal, ' +
      'Maheshwari, and Khandelwal families. Pure-vegetarian, Jain-dietary matching ' +
      'with sect compatibility.',
    highlights: [
      'Digambara and Shvetambara matching',
      'Oswal, Porwal, Agarwal, Maheshwari sub-communities',
      'Strict Jain dietary filters',
      'Verified Jain families across India',
    ],
  },
  {
    slug:  'patel',
    label: 'Patel',
    description:
      'Patel marriage bureau for Leuva, Kadva, Anjana, Charotar, and pan-Gujarat ' +
      'Patel families. Business-family compatibility, NRI coverage, and full Guna ' +
      'Milan scoring.',
    highlights: [
      'Leuva, Kadva, Anjana sub-community matching',
      'Pan-Gujarat and NRI Patel coverage',
      'Business family compatibility',
      'Verified Patel families with KYC',
    ],
  },
  {
    slug:  'reddy',
    label: 'Reddy',
    description:
      'Reddy marriage bureau for Motati, Pakanati, Pedakanti, Velama-Reddy, and ' +
      'pan-Telugu Reddy families. Strong community-rooted matching with cultural ' +
      'compatibility.',
    highlights: [
      'Motati, Pakanati, Pedakanti sub-community matching',
      'Pan-Telugu coverage: AP and Telangana',
      'Strong community-rooted matchmaking',
      'Verified Reddy families with KYC',
    ],
  },
  {
    slug:  'agarwal',
    label: 'Agarwal',
    description:
      'Agarwal marriage bureau for the 17 gotras — Garg, Goyal, Mittal, Singhal, ' +
      'Bansal, Mangal, Bindal, Dharan, and more. Business-family compatibility with ' +
      'gotra-exogamy filters.',
    highlights: [
      'All 17 Agarwal gotras with exogamy filters',
      'Business and trading family networks',
      'Pan-North India and NRI coverage',
      'Verified Agarwal families with KYC',
    ],
  },
];

// ── Slug resolution ──────────────────────────────────────────────────────────

export type PageKind =
  | { kind: 'community'; data: Community }
  | { kind: 'city';      data: City }
  | { kind: 'caste';     data: Caste };

const COMMUNITY_SUFFIX = '-matrimony';
const CITY_PREFIX      = 'marriages-in-';
const CASTE_SUFFIX     = '-marriage-bureau';

export function resolveSlug(slug: string): PageKind | null {
  if (slug.endsWith(COMMUNITY_SUFFIX)) {
    const key = slug.slice(0, -COMMUNITY_SUFFIX.length);
    const data = COMMUNITIES.find((c) => c.slug === key);
    return data ? { kind: 'community', data } : null;
  }
  if (slug.startsWith(CITY_PREFIX)) {
    const key = slug.slice(CITY_PREFIX.length);
    const data = CITIES.find((c) => c.slug === key);
    return data ? { kind: 'city', data } : null;
  }
  if (slug.endsWith(CASTE_SUFFIX)) {
    const key = slug.slice(0, -CASTE_SUFFIX.length);
    const data = CASTES.find((c) => c.slug === key);
    return data ? { kind: 'caste', data } : null;
  }
  return null;
}

/** All slugs handled by [slug] catch-all — used by generateStaticParams + sitemap. */
export function allSlugs(): string[] {
  return [
    ...COMMUNITIES.map((c) => `${c.slug}${COMMUNITY_SUFFIX}`),
    ...CITIES     .map((c) => `${CITY_PREFIX}${c.slug}`),
    ...CASTES     .map((c) => `${c.slug}${CASTE_SUFFIX}`),
  ];
}
