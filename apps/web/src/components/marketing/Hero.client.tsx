'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, MotionConfig, useReducedMotion, type Variants } from 'framer-motion';
import { ShieldCheck, Lock, Users, Sparkles, Flower2, UserCheck, type LucideIcon } from 'lucide-react';
import { MatchPhoneCard } from './MatchPhoneCard.client';
import floralIvory from '../../../public/landing/floral-ivory.webp';
import coupleGolden from '../../../public/landing/couple-golden.webp';

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

// Deterministic petal field (fixed so SSR and client markup match).
const PETALS = [
  { left: '6%',  top: '20%', size: 10, delay: 0,   dur: 9 },
  { left: '20%', top: '72%', size: 7,  delay: 1.6, dur: 11 },
  { left: '36%', top: '26%', size: 8,  delay: 0.7, dur: 10 },
  { left: '52%', top: '82%', size: 6,  delay: 2.2, dur: 12 },
  { left: '68%', top: '16%', size: 9,  delay: 0.4, dur: 9.5 },
  { left: '82%', top: '58%', size: 7,  delay: 1.9, dur: 10.5 },
  { left: '92%', top: '32%', size: 8,  delay: 1.1, dur: 11.5 },
  { left: '14%', top: '44%', size: 6,  delay: 2.7, dur: 13 },
] as const;

// Mughal-arch photo mask (elliptical top, card-radius bottom)
const ARCH_RADIUS = '50% 50% 1rem 1rem / 36% 36% 1rem 1rem';

type ChipKey = 'chipVerified' | 'chipFamily' | 'chipAI' | 'chipGuna' | 'chipPrivacy' | 'chipHuman';

const CHIPS: ReadonlyArray<{ key: ChipKey; Icon: LucideIcon }> = [
  { key: 'chipVerified', Icon: ShieldCheck },
  { key: 'chipFamily',   Icon: Users },
  { key: 'chipAI',       Icon: Sparkles },
  { key: 'chipGuna',     Icon: Flower2 },
  { key: 'chipPrivacy',  Icon: Lock },
  { key: 'chipHuman',    Icon: UserCheck },
];

// ── Hero section ──────────────────────────────────────────────────────────────
export default function Hero() {
  const t = useTranslations('marketing.hero');
  const reduce = useReducedMotion();
  // Petals are client-only: rendering them during SSR/first paint would
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
      {/* Ivory floral texture (reference asset), softened + faded into page bg */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
        <Image
          src={floralIvory}
          alt=""
          fill
          loading="eager"
          sizes="100vw"
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-background/45" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>
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

      {/* Drifting rose petals (client-only to keep hydration stable) */}
      {mounted && !reduce && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          {PETALS.map((p, i) => (
            <motion.span
              key={i}
              className="absolute"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size * 0.8,
                borderRadius: '62% 38% 55% 45% / 48% 60% 40% 52%',
                background: 'color-mix(in srgb, var(--color-rose) 65%, transparent)',
              }}
              animate={{ y: [0, 26, 0], rotate: [0, 24, 0], opacity: [0.12, 0.45, 0.12] }}
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

      {/* ── Content — 52/48 split desktop, stacked + centered mobile ───────── */}
      <div className="relative z-10 mx-auto flex w-full max-w-screen-xl flex-col items-center gap-10 px-4 pb-16 pt-28 sm:gap-12 sm:pb-20 md:px-6 lg:flex-row lg:gap-8 lg:pb-24 lg:pt-32">
        {/* ── LEFT — the thesis ──────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="w-full flex-1 text-center lg:max-w-[52%] lg:text-left"
        >
          {/* Eyebrow pill */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-surface/70 px-3.5 py-1.5 backdrop-blur-sm"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-gold" />
            <span className="whitespace-nowrap text-2xs font-semibold uppercase tracking-[0.14em] text-gold-muted sm:tracking-[0.18em]">
              {t('eyebrow')}
            </span>
            <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-gold" />
          </motion.div>

          {/* H1 — ink first line, burgundy italic emphasis with drawn underline */}
          <motion.h1
            variants={itemVariants}
            className="mt-5 font-heading font-semibold leading-[1.08] text-foreground sm:mt-6"
            style={{ fontSize: 'clamp(2.15rem, 6vw, 4.25rem)' }}
          >
            {t.rich('heading', {
              em: (chunks) => (
                <em className="relative inline text-primary">
                  {chunks}
                  <motion.svg
                    aria-hidden="true"
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-2 left-0 h-[0.32em] w-full"
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
                </em>
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

          {/* Trust chips */}
          <motion.ul
            variants={itemVariants}
            className="mt-7 flex max-w-[560px] flex-wrap justify-center gap-x-5 gap-y-2.5 lg:justify-start"
          >
            {CHIPS.map(({ key, Icon }) => (
              <li key={key} className="flex items-center gap-1.5 text-xs text-foreground/70">
                <Icon className="h-4 w-4 flex-shrink-0 text-gold-muted" aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </motion.ul>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="mt-8 flex flex-col justify-center gap-3 sm:mt-10 sm:flex-row lg:justify-start"
          >
            <Link
              href="/register"
              className="group relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span className="relative z-10">{t('primaryCta')}</span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
              />
            </Link>
            <Link
              href="/register?mode=family"
              className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-gold/40 bg-surface px-8 py-3.5 text-base font-semibold text-gold-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
            >
              {t('secondaryCta')}
            </Link>
          </motion.div>

          {/* Microcopy */}
          <motion.p variants={itemVariants} className="mt-3 text-xs text-muted-foreground">
            {t('microcopy')}
          </motion.p>
        </motion.div>

        {/* ── RIGHT — the signature (arch photo + live match card) ────────── */}
        <motion.div
          initial={{ opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 0.35, ease: EASE }}
          className="flex w-full justify-center lg:max-w-[48%]"
        >
          <div className="relative w-full max-w-[440px]">
            {/* Arch-framed couple photo */}
            <div
              className="relative ml-auto w-[80%] border border-gold/40 bg-surface/60 p-1.5 shadow-[var(--shadow-lg)] sm:w-[76%]"
              style={{ borderRadius: ARCH_RADIUS }}
            >
              <div
                className="relative aspect-[4/5] overflow-hidden"
                style={{ borderRadius: ARCH_RADIUS }}
              >
                {/* Mobile shifts the crop left so the couple clears the overlapping card */}
                <Image
                  src={coupleGolden}
                  alt={t('photoAlt')}
                  fill
                  priority
                  sizes="(min-width: 1024px) 36vw, 76vw"
                  className="object-cover object-[20%_22%] sm:object-[48%_22%]"
                />
              </div>
            </div>

            {/* Floating "Safe & Secure" chip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={
                reduce
                  ? { opacity: 1, y: 0 }
                  : { opacity: 1, y: [0, -6, 0] }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : { opacity: { duration: 0.6, delay: 1.0 }, y: { duration: 5, delay: 1.0, repeat: Infinity, ease: 'easeInOut' } }
              }
              className="absolute -right-1 top-[12%] flex items-center gap-2 rounded-xl border border-gold/25 bg-surface/95 px-3 py-2 shadow-[var(--shadow-md)] backdrop-blur-sm sm:right-0"
            >
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-gold-muted" aria-hidden="true" />
              <span>
                <span className="block text-xs font-semibold leading-tight text-foreground">{t('safeChipTitle')}</span>
                <span className="block text-2xs leading-tight text-muted-foreground">{t('safeChipBody')}</span>
              </span>
            </motion.div>

            {/* Match phone card, overlapping the arch */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.65, ease: EASE }}
              className="absolute bottom-4 left-0 w-[178px] sm:w-[218px]"
            >
              <MatchPhoneCard ariaLabel={t('phoneCardAlt')} />
            </motion.div>
          </div>
        </motion.div>
      </div>

    </section>
    </MotionConfig>
  );
}
