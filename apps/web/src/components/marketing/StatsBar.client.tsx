'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber.client';

interface Stat {
  numericValue: number;
  format: (n: number) => string;
  labelKey: string;
}

const stats: Stat[] = [
  {
    numericValue: 12000,
    format: (n) => `${Math.round(n / 1000)}k+`,
    labelKey: 'verifiedProfiles',
  },
  {
    numericValue: 850,
    format: (n) => `${Math.round(n)}+`,
    labelKey: 'vendors',
  },
  {
    numericValue: 1200,
    format: (n) => `${Math.round(n / 100) * 100}+`,
    labelKey: 'weddings',
  },
];

function StatItem({ stat, index }: { stat: Stat; index: number }) {
  const t = useTranslations('marketing.stats');
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center px-6"
    >
      <dt className="sr-only">{t(stat.labelKey)}</dt>
      <dd
        className="font-[family-name:var(--font-heading)] font-bold text-primary leading-none"
        style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)' }}
        aria-live="polite"
      >
        {inView ? (
          <AnimatedNumber
            value={stat.numericValue}
            duration={1.4}
            format={stat.format}
          />
        ) : (
          stat.format(0)
        )}
      </dd>
      <p className="mt-2 text-sm text-foreground/60 leading-snug max-w-[140px]">
        {t(stat.labelKey)}
      </p>
    </motion.div>
  );
}

export default function StatsBar() {
  return (
    <section
      id="stats"
      aria-label="Platform statistics"
      className="relative bg-background border-y border-gold/15 py-14 md:py-16 overflow-hidden"
    >
      {/* Subtle gold tint band */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-gold) 5%, transparent) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-screen-xl mx-auto px-4 md:px-6">
        <dl className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-0 sm:divide-x sm:divide-gold/20">
          {stats.map((s, i) => (
            <StatItem key={s.labelKey} stat={s} index={i} />
          ))}
        </dl>
      </div>
    </section>
  );
}
