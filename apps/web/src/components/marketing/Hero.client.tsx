'use client';

import { useEffect, useState, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { ShieldCheck, Lock, Star } from 'lucide-react';
import { ProfileCard } from '@/components/ui/ProfileCard.client';

// ── Mock profiles cycling in the right panel ──────────────────────────────────
interface MockProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  profession: string;
  compatibilityPct: number;
  gunaScore: number;
  isVerified: boolean;
}

const MOCK_PROFILES: MockProfile[] = [
  { id: 'p1', name: 'Priya Sharma',  age: 26, city: 'Mumbai',    profession: 'Doctor',            compatibilityPct: 92, gunaScore: 34, isVerified: true },
  { id: 'p2', name: 'Ananya Iyer',   age: 25, city: 'Bangalore', profession: 'Software Engineer', compatibilityPct: 87, gunaScore: 31, isVerified: true },
  { id: 'p3', name: 'Kaveri Nair',   age: 28, city: 'Chennai',   profession: 'Architect',         compatibilityPct: 95, gunaScore: 35, isVerified: true },
  { id: 'p4', name: 'Meera Joshi',   age: 24, city: 'Pune',      profession: 'CA',                compatibilityPct: 83, gunaScore: 29, isVerified: true },
  { id: 'p5', name: 'Divya Reddy',   age: 27, city: 'Hyderabad', profession: 'Researcher',        compatibilityPct: 89, gunaScore: 32, isVerified: true },
];

// ── Animation variants ────────────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

const cardVariants: Variants = {
  enter: { opacity: 0, y: 16, scale: 0.97 },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.98,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
  },
};

// ── Hero section ──────────────────────────────────────────────────────────────
export default function Hero() {
  const t = useTranslations('marketing.hero');
  const reduce = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);

  const advance = useCallback(() => {
    setActiveIdx((i) => (i + 1) % MOCK_PROFILES.length);
  }, []);

  // Auto-cycle every 4 s; skip when user prefers reduced motion
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(advance, 4000);
    return () => clearInterval(id);
  }, [advance, reduce]);

  // activeIdx is always in [0, MOCK_PROFILES.length - 1] by modulo arithmetic
  const activeProfile = MOCK_PROFILES[activeIdx] ?? MOCK_PROFILES[0]!;

  return (
    <section
      id="hero"
      aria-label="Smart Shaadi — find your perfect match"
      className="relative isolate overflow-hidden bg-background"
      style={{ minHeight: 'clamp(640px, 60vh, 820px)' }}
    >
      {/* Gold gradient mesh — top-right corner, CSS vars only, no raw hex */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 70% 30%,' +
            ' color-mix(in srgb, var(--color-gold) 18%, transparent) 0%,' +
            ' color-mix(in srgb, var(--color-gold) 6%, transparent) 45%,' +
            ' transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 80% 50%,' +
            ' color-mix(in srgb, var(--color-primary) 8%, transparent) 0%,' +
            ' transparent 65%)',
        }}
      />

      {/* Main content — 55/45 split desktop, stacked mobile */}
      <div className="relative max-w-screen-xl mx-auto px-4 md:px-6 py-20 md:py-28 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">

        {/* ── LEFT 55% — headline + CTAs ──────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 lg:max-w-[55%] w-full"
        >
          {/* Eyebrow */}
          <motion.p
            variants={itemVariants}
            aria-hidden="true"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted border-l-2 border-gold pl-3 mb-6"
          >
            EST. 2026 · INDIA&apos;S SMARTEST MATRIMONIAL
          </motion.p>

          {/* H1 */}
          <motion.h1
            variants={itemVariants}
            className="font-[family-name:var(--font-heading)] font-semibold leading-[1.08] text-primary"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)' }}
          >
            {t('heading')}
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={itemVariants}
            className="mt-6 text-base md:text-lg text-foreground/80 max-w-[540px] leading-relaxed"
          >
            {t('subtext')}
          </motion.p>

          {/* Trust badges */}
          <motion.ul
            variants={itemVariants}
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2"
          >
            <li className="flex items-center gap-1.5 text-xs text-foreground/70">
              <ShieldCheck className="w-4 h-4 text-teal flex-shrink-0" aria-hidden="true" />
              Verified Profiles
            </li>
            <li className="flex items-center gap-1.5 text-xs text-foreground/70">
              <Lock className="w-4 h-4 text-teal flex-shrink-0" aria-hidden="true" />
              Privacy First
            </li>
            <li className="flex items-center gap-1.5 text-xs text-foreground/70">
              <Star className="w-4 h-4 text-gold flex-shrink-0" aria-hidden="true" />
              4.8★ Rating
            </li>
          </motion.ul>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="mt-10 flex flex-col sm:flex-row gap-3"
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center min-h-[48px] rounded-lg px-8 py-3 bg-teal text-white font-semibold text-base transition-all duration-200 shadow-md shadow-teal/25 hover:bg-teal-hover hover:shadow-lg hover:shadow-teal/35 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              {t('primaryCta')}
            </Link>
            <Link
              href="/vendors"
              className="inline-flex items-center justify-center min-h-[48px] rounded-lg px-8 py-3 border border-gold/40 bg-surface text-gold-muted font-semibold text-base transition-all duration-200 hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
            >
              {t('secondaryCta')}
            </Link>
          </motion.div>

          {/* Microcopy */}
          <motion.p
            variants={itemVariants}
            className="mt-3 text-xs text-foreground/50"
          >
            {t('microcopy')}
          </motion.p>
        </motion.div>

        {/* ── RIGHT 45% — rotating ProfileCards ───────────────────────────── */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="lg:max-w-[45%] w-full flex flex-col items-center gap-4"
        >
          {/* Animated card crossfade */}
          <div
            className="relative w-full max-w-[340px] h-[420px]"
            aria-label={`Showing example profile: ${activeProfile.name}`}
            aria-live="polite"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProfile.id}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
              >
                <ProfileCard
                  name={activeProfile.name}
                  age={activeProfile.age}
                  city={activeProfile.city}
                  profession={activeProfile.profession}
                  photoUrl={null}
                  isVerified={activeProfile.isVerified}
                  compatibilityPct={activeProfile.compatibilityPct}
                  gunaScore={activeProfile.gunaScore}
                  className="h-full"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagination dots */}
          <div
            className="flex gap-2"
            role="tablist"
            aria-label="Browse example profiles"
          >
            {MOCK_PROFILES.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === activeIdx}
                aria-label={`View profile ${i + 1} of ${MOCK_PROFILES.length}`}
                onClick={() => setActiveIdx(i)}
                className={[
                  'h-1.5 rounded-full transition-all duration-300',
                  i === activeIdx
                    ? 'w-6 bg-teal'
                    : 'w-1.5 bg-gold/30 hover:bg-gold/60',
                ].join(' ')}
              />
            ))}
          </div>

          {/* Depth shadow strip below card */}
          <div
            aria-hidden="true"
            className="w-full max-w-[300px] h-2 rounded-b-2xl border border-gold/10 bg-surface shadow-card"
          />
        </motion.div>
      </div>
    </section>
  );
}
