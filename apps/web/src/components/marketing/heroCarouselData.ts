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
}

/**
 * Mock profiles used by the marketing hero carousel. Names span multiple
 * regions of India so the carousel doesn't read as a single-community demo.
 * Avatars use the initialed fallback (no real photo) — see HeroCarousel.
 */
export const HERO_PROFILES: HeroProfile[] = [
  { id: 'ananya',  name: 'Ananya Iyer',   age: 25, city: 'Bangalore',  profession: 'Software Engineer', initial: 'A', verified: true, compatibilityScore: 92, gunaScore: 30, accent: 'teal'    },
  { id: 'riya',    name: 'Riya Sharma',   age: 27, city: 'Pune',       profession: 'Doctor',            initial: 'R', verified: true, compatibilityScore: 89, gunaScore: 32, accent: 'gold'    },
  { id: 'priya',   name: 'Priya Reddy',   age: 26, city: 'Hyderabad',  profession: 'Architect',         initial: 'P', verified: true, compatibilityScore: 94, gunaScore: 34, accent: 'primary' },
  { id: 'anjali',  name: 'Anjali Kapoor', age: 28, city: 'Delhi',      profession: 'Marketing',         initial: 'A', verified: true, compatibilityScore: 87, gunaScore: 29, accent: 'teal'    },
  { id: 'sneha',   name: 'Sneha Patel',   age: 25, city: 'Ahmedabad',  profession: 'CA',                initial: 'S', verified: true, compatibilityScore: 91, gunaScore: 31, accent: 'gold'    },
];
