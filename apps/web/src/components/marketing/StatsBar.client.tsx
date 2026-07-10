'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Users, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Eyebrow } from './Ornament';

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
      className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-blush/40 px-4 py-2"
    >
      <Icon className="h-4 w-4 text-gold-muted" aria-hidden="true" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </motion.div>
  );
}

export default function StatsBar() {
  const t = useTranslations('landing.earlyAccess');
  return (
    <section id="stats" aria-label={t('label')} className="relative z-20 bg-background pb-14 md:pb-16">
      {/* Porcelain card pulled up over the hero's bottom edge */}
      <div className="mx-auto -mt-10 max-w-screen-lg px-4 md:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-surface/95 px-6 py-8 text-center shadow-[var(--shadow-lg)] backdrop-blur-sm md:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
          />
          <Eyebrow>{t('label')}</Eyebrow>
          <h2 className="mt-3 font-heading text-xl font-semibold text-primary md:text-2xl">
            {t('tagline')}
          </h2>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {PILLS.map((p, i) => (
              <PillItem key={p.key} pill={p} index={i} label={t(`pills.${p.key}` as 'pills.verifiedProfiles')} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
