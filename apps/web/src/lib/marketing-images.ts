/*
 * Centralized photo URL constants for the marketing landing page.
 * All photos sourced from Pexels (free under Pexels License — no attribution required).
 *
 * To swap stock photos for client brand photography later, change ONLY the `src`
 * field of each constant. Keep the same width/height/alt unless the new asset's
 * dimensions differ.
 *
 * URL pattern: https://images.pexels.com/photos/{ID}/pexels-photo-{ID}.jpeg?...
 * Add ?auto=compress&cs=tinysrgb&w={target_width} for size variants.
 */

export type Photo = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

const cdn = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

// ─── HERO ────────────────────────────────────────────────────────────────────
export const HERO_BG: Photo = {
  src: cdn(8621982, 1920),
  width: 1920,
  height: 1280,
  alt: 'Indian bride and groom in traditional wedding attire touching foreheads, with soft pink and gold backdrop',
};

// ─── TRUST SECTION ───────────────────────────────────────────────────────────
export const TRUST_INDIVIDUALS: Photo = {
  src: cdn(30276936, 1200),
  width: 1200,
  height: 1800,
  alt: 'Indian bride in golden saree looking confidently into the distance',
};

export const TRUST_FAMILIES: Photo = {
  src: cdn(6500527, 1200),
  width: 1200,
  height: 800,
  alt: 'Indian family taking a group selfie together at a wedding celebration',
};

// ─── HOW IT WORKS (3 alternating rows) ──────────────────────────────────────
export const HOW_STEP_PROFILE: Photo = {
  src: cdn(14798020, 900),
  width: 900,
  height: 1350,
  alt: 'Smiling Indian woman in traditional white attire looking at her smartphone',
};

export const HOW_STEP_MATCHES: Photo = {
  src: cdn(30367537, 900),
  width: 900,
  height: 770,
  alt: 'Indian couple in traditional clothing sitting close together on staircase',
};

export const HOW_STEP_FAMILY: Photo = {
  src: cdn(18394079, 900),
  width: 900,
  height: 600,
  alt: 'Indian grandparents playing with a young grandchild outdoors',
};

// ─── FEATURES GRID (6 cards) ─────────────────────────────────────────────────
export const FEATURE_GUNA_MILAN: Photo = {
  src: cdn(17343894, 600),
  width: 600,
  height: 837,
  alt: 'Indian bridal hands decorated with intricate red mehendi henna designs and gold bangles',
};

export const FEATURE_SAFETY: Photo = {
  src: cdn(8819447, 600),
  width: 600,
  height: 400,
  alt: 'Two Indian women in colorful traditional dress sharing a phone screen together',
};

export const FEATURE_PLANNING: Photo = {
  src: cdn(34079355, 600),
  width: 600,
  height: 400,
  alt: 'Elegant Indian wedding mandap decorated with floral garlands and crystal chandeliers',
};

export const FEATURE_FAMILY_MODE: Photo = {
  src: cdn(6500527, 600),
  width: 600,
  height: 400,
  alt: 'Multi-generational Indian family taking a selfie together at a wedding ceremony',
};

export const FEATURE_AI_COACH: Photo = {
  src: cdn(36098363, 600),
  width: 600,
  height: 400,
  alt: 'Indian wedding couple smiling and posing together outdoors among palm trees',
};

export const FEATURE_VENDOR: Photo = {
  src: cdn(35843780, 600),
  width: 600,
  height: 400,
  alt: 'Traditional Indian wedding ceremony in progress with family and ritual elements',
};

// ─── CTA BANNER ──────────────────────────────────────────────────────────────
export const CTA_BG: Photo = {
  src: cdn(19613670, 1920),
  width: 1920,
  height: 1280,
  alt: 'Elegant Indian groom and bride in royal red and gold attire at their wedding',
};

// ─── TESTIMONIALS (avatar portraits, square crops) ──────────────────────────
export const TESTIMONIAL_RAHUL: Photo = {
  src: cdn(37070489, 200),
  width: 200,
  height: 200,
  alt: 'Portrait of Rahul Sharma, a young Indian man in traditional groom attire',
};

export const TESTIMONIAL_KAVITA: Photo = {
  src: cdn(14798020, 200),
  width: 200,
  height: 200,
  alt: 'Portrait of Mrs. Kavita Patel, an Indian mother in traditional dress',
};

export const TESTIMONIAL_COUPLE: Photo = {
  src: cdn(33558676, 200),
  width: 200,
  height: 200,
  alt: 'Portrait of Ananya and Vikram, a happy Indian couple smiling together',
};
