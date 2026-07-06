'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, MotionConfig, useReducedMotion, type Variants } from 'framer-motion';
import { ShieldCheck, Lock, Star } from 'lucide-react';
import { HeroCarousel } from './HeroCarousel.client';

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Page-load orchestration ───────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

// Deterministic particle field (fixed so SSR and client markup match).
const PARTICLES = [
  { left: '8%', top: '18%', size: 6, delay: 0, dur: 7 },
  { left: '22%', top: '68%', size: 4, delay: 1.4, dur: 9 },
  { left: '38%', top: '30%', size: 5, delay: 0.8, dur: 8 },
  { left: '54%', top: '80%', size: 3, delay: 2.1, dur: 10 },
  { left: '70%', top: '22%', size: 5, delay: 0.5, dur: 7.5 },
  { left: '84%', top: '60%', size: 4, delay: 1.9, dur: 9.5 },
  { left: '92%', top: '36%', size: 6, delay: 1.1, dur: 8.5 },
  { left: '16%', top: '46%', size: 3, delay: 2.6, dur: 11 },
  { left: '63%', top: '50%', size: 4, delay: 0.3, dur: 8 },
  { left: '46%', top: '12%', size: 5, delay: 1.6, dur: 9 },
] as const;

// ── Hero section ──────────────────────────────────────────────────────────────
export default function Hero() {
  const t = useTranslations('marketing.hero');
  const reduce = useReducedMotion();
  // Particles are client-only: rendering them during SSR/first paint would
  // diverge from a reduced-motion client and break hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <MotionConfig reducedMotion="user">
    <section
      id="hero"
      aria-label="Smart Shaadi — find your perfect match"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-background"
    >
      {/* ── Ambient background ─────────────────────────────────────────────── */}
      {/* Gold mesh, top-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 -z-10 h-[680px] w-[680px] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 70% 30%,' +
            ' color-mix(in srgb, var(--color-gold) 20%, transparent) 0%,' +
            ' color-mix(in srgb, var(--color-gold) 7%, transparent) 45%,' +
            ' transparent 70%)',
        }}
      />
      {/* Peach/burgundy wash, bottom-left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 -z-10 h-[560px] w-[560px] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 30% 70%,' +
            ' color-mix(in srgb, var(--color-peach) 45%, transparent) 0%,' +
            ' color-mix(in srgb, var(--color-primary) 6%, transparent) 45%,' +
            ' transparent 72%)',
        }}
      />
      {/* Faint mandala texture, centered behind visual */}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        className="pointer-events-none absolute right-[6%] top-1/2 -z-10 hidden h-[520px] w-[520px] -translate-y-1/2 text-gold opacity-[0.05] lg:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      >
        {[92, 74, 56, 38].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} />
        ))}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i * Math.PI) / 12;
          return (
            <line
              key={i}
              x1={100 + 38 * Math.cos(a)}
              y1={100 + 38 * Math.sin(a)}
              x2={100 + 92 * Math.cos(a)}
              y2={100 + 92 * Math.sin(a)}
            />
          );
        })}
      </svg>

      {/* Drifting gold particles (client-only to keep hydration stable) */}
      {mounted && !reduce && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          {PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                background: 'color-mix(in srgb, var(--color-gold) 70%, transparent)',
              }}
              animate={{ y: [0, -20, 0], opacity: [0.15, 0.5, 0.15] }}
              transition={{
                duration: p.dur,
                delay: p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Content — 54/46 split desktop, stacked + centered mobile ───────── */}
      <div className="relative z-10 mx-auto flex w-full max-w-screen-xl flex-col items-center gap-8 px-4 py-14 sm:gap-10 sm:py-16 md:px-6 md:py-24 lg:flex-row lg:gap-10 lg:py-28">
        {/* ── LEFT — the thesis ──────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="w-full flex-1 text-center lg:max-w-[54%] lg:text-left"
        >
          {/* Eyebrow pill */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3.5 py-1.5"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-muted">
              {t('eyebrow')}
            </span>
          </motion.div>

          {/* H1 with self-drawing gold underline on the highlighted word */}
          <motion.h1
            variants={itemVariants}
            className="mt-5 font-heading font-semibold leading-[1.05] text-primary sm:mt-6"
            style={{ fontSize: 'clamp(2.15rem, 6.5vw, 4.5rem)' }}
          >
            {t.rich('heading', {
              em: (chunks) => (
                <span className="relative inline-block whitespace-nowrap text-gold">
                  {chunks}
                  <motion.svg
                    aria-hidden="true"
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1.5 left-0 h-[0.4em] w-full"
                    fill="none"
                  >
                    <motion.path
                      d="M2 8 C 44 3, 88 3, 118 7 S 172 11, 198 5"
                      stroke="var(--color-gold)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.85, ease: EASE }}
                    />
                  </motion.svg>
                </span>
              ),
            })}
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={itemVariants}
            className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-foreground/80 md:text-lg lg:mx-0"
          >
            {t('subtext')}
          </motion.p>

          {/* Trust badges */}
          <motion.ul
            variants={itemVariants}
            className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start"
          >
            <li className="flex items-center gap-1.5 text-xs text-foreground/70">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-teal" aria-hidden="true" />
              {t('badgeVerified')}
            </li>
            <li className="flex items-center gap-1.5 text-xs text-foreground/70">
              <Lock className="h-4 w-4 flex-shrink-0 text-teal" aria-hidden="true" />
              {t('badgePrivacy')}
            </li>
            <li className="flex items-center gap-1.5 text-xs text-foreground/70">
              <Star className="h-4 w-4 flex-shrink-0 text-gold" aria-hidden="true" />
              {t('badgeRating')}
            </li>
          </motion.ul>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="mt-8 flex flex-col justify-center gap-3 sm:mt-10 sm:flex-row lg:justify-start"
          >
            <Link
              href="/register"
              className="group relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-xl bg-teal px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-hover hover:shadow-xl hover:shadow-teal/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <span className="relative z-10">{t('primaryCta')}</span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
              />
            </Link>
            <Link
              href="/vendors"
              className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-gold/40 bg-surface px-8 py-3.5 text-base font-semibold text-gold-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
            >
              {t('secondaryCta')}
            </Link>
          </motion.div>

          {/* Microcopy */}
          <motion.p variants={itemVariants} className="mt-3 text-xs text-foreground/50">
            {t('microcopy')}
          </motion.p>
        </motion.div>

        {/* ── RIGHT — the signature (3D match cluster) ───────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 0.35, ease: EASE }}
          className="flex w-full justify-center lg:max-w-[46%]"
        >
          <HeroCarousel />
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-gold-muted sm:flex"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.2em]">{t('scrollCue')}</span>
        <span className="flex h-8 w-5 justify-center rounded-full border border-gold/40 pt-1.5">
          <motion.span
            className="block h-1.5 w-1 rounded-full bg-gold"
            animate={reduce ? {} : { y: [0, 9, 0], opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          />
        </span>
      </motion.div>
    </section>
    </MotionConfig>
  );
}
