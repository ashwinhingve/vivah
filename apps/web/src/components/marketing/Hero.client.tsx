'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ShieldCheck, Lock, Star } from 'lucide-react';
import { HeroCarousel } from './HeroCarousel.client';

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

// ── Hero section ──────────────────────────────────────────────────────────────
export default function Hero() {
  const t = useTranslations('marketing.hero');
  const reduce = useReducedMotion();

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
            className="font-heading font-semibold leading-[1.08] text-primary"
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

        {/* ── RIGHT 45% — HeroCarousel (stack of 3 cards, auto-rotate) ──── */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="lg:max-w-[45%] w-full"
        >
          <HeroCarousel />
        </motion.div>
      </div>
    </section>
  );
}
