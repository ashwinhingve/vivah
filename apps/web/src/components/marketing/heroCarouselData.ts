export interface HeroProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  profession: string;
  initial: string;
  verified: boolean;
  compatibilityScore: number;
  gunaScore: number;
  /** Accent used in non-photo fallback states. */
  accent: 'teal' | 'gold' | 'primary';
  /** AI-generated portrait with burned-in name/city/profession overlay. */
  photoUrl: string;
}

/**
 * AI-generated demo profiles for the marketing hero carousel. Each portrait
 * has overlay typography burned into the image — HeroCarousel renders the
 * webp directly via next/image with no separate text layer.
 * See docs/BRAND-ASSETS.md for generation rules.
 */
export const HERO_PROFILES: HeroProfile[] = [
  { id: 'ananya', name: 'Ananya Iyer',   age: 25, city: 'Bangalore', profession: 'Software Engineer', initial: 'A', verified: true, compatibilityScore: 92, gunaScore: 30, accent: 'teal',    photoUrl: '/hero/ananya-iyer.webp'   },
  { id: 'riya',   name: 'Riya Sharma',   age: 27, city: 'Pune',      profession: 'Doctor',            initial: 'R', verified: true, compatibilityScore: 89, gunaScore: 32, accent: 'gold',    photoUrl: '/hero/riya-sharma.webp'   },
  { id: 'priya',  name: 'Priya Reddy',   age: 26, city: 'Hyderabad', profession: 'Architect',         initial: 'P', verified: true, compatibilityScore: 94, gunaScore: 34, accent: 'primary', photoUrl: '/hero/priya-reddy.webp'   },
  { id: 'anjali', name: 'Anjali Kapoor', age: 28, city: 'Delhi',     profession: 'Marketing',         initial: 'A', verified: true, compatibilityScore: 87, gunaScore: 29, accent: 'teal',    photoUrl: '/hero/anjali-kapoor.webp' },
  { id: 'sneha',  name: 'Sneha Patel',   age: 25, city: 'Ahmedabad', profession: 'CA',                initial: 'S', verified: true, compatibilityScore: 91, gunaScore: 31, accent: 'gold',    photoUrl: '/hero/sneha-patel.webp'   },
];
