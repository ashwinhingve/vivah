'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Users, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type PillKey = 'verifiedProfiles' | 'familyFirst' | 'privacyDefault';

interface Pill {
  Icon: LucideIcon;
  key: PillKey;
}

const PILLS: Pill[] = [
  { Icon: ShieldCheck, key: 'verifiedProfiles' },
  { Icon: Users,       key: 'familyFirst' },
  { Icon: Lock,        key: 'privacyDefault' },
];

function PillItem({ pill, index, label }: { pill: Pill; index: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduce = useReducedMotion();
  const { Icon } = pill;

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-surface px-4 py-2 shadow-sm"
    >
      <Icon className="h-4 w-4 text-teal" aria-hidden="true" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </motion.div>
  );
}

export default function StatsBar() {
  const t = useTranslations('landing.earlyAccess');
  return (
    <section
      id="stats"
      aria-label={t('label')}
      className="relative bg-background border-y border-gold/15 py-12 md:py-14 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-gold) 5%, transparent) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-screen-xl mx-auto px-4 md:px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-muted">
          {t('label')}
        </p>
        <h2 className="mt-2 font-heading text-xl md:text-2xl font-semibold text-primary">
          {t('tagline')}
        </h2>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {PILLS.map((p, i) => (
            <PillItem key={p.key} pill={p} index={i} label={t(`pills.${p.key}` as 'pills.verifiedProfiles')} />
          ))}
        </div>
      </div>
    </section>
  );
}
