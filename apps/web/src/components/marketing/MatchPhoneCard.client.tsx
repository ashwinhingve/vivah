'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck } from 'lucide-react';
import avatarBride from '../../../public/landing/avatar-bride.webp';

const EASE = [0.16, 1, 0.3, 1] as const;

const MINI_STATS = [
  { label: 'Family', value: '95%' },
  { label: 'Education', value: '91%' },
  { label: 'Values', value: '94%' },
] as const;

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const COMPATIBILITY = 0.92;

/**
 * Hero signature: a phone-styled match card rendered as real DOM.
 * Pure demo UI (fictional profile) — content is decorative for screen
 * readers; the container carries a single descriptive label.
 */
export function MatchPhoneCard({ ariaLabel }: { ariaLabel: string }) {
  const reduce = useReducedMotion();

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="w-full rounded-[1.75rem] border border-gold/25 bg-surface/95 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-sm"
    >
      <div aria-hidden="true" className="rounded-[1.35rem] border border-border-light bg-surface px-3.5 pb-3.5 pt-3">
        {/* Profile header */}
        <div className="flex items-center gap-2.5">
          <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gold/40">
            <Image src={avatarBride} alt="" fill sizes="40px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate font-heading text-sm font-semibold text-foreground">Priya Sharma</span>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-teal" />
            </span>
            <span className="block text-[10px] text-muted-foreground">27 · Doctor · Jaipur</span>
          </span>
        </div>

        {/* Compatibility ring */}
        <div className="mt-3 flex justify-center">
          <span className="relative inline-flex h-[92px] w-[92px] items-center justify-center">
            <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="var(--border-light)" strokeWidth="5" />
              <motion.circle
                cx="40"
                cy="40"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                initial={{ strokeDashoffset: reduce ? RING_CIRCUMFERENCE * (1 - COMPATIBILITY) : RING_CIRCUMFERENCE }}
                animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - COMPATIBILITY) }}
                transition={reduce ? { duration: 0 } : { duration: 1.2, delay: 0.9, ease: EASE }}
              />
            </svg>
            <span className="text-center">
              <span className="block font-heading text-xl font-bold leading-none text-primary">92%</span>
              <span className="mt-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground">Compatibility</span>
            </span>
          </span>
        </div>

        {/* Mini match stats */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {MINI_STATS.map((s) => (
            <span key={s.label} className="rounded-lg bg-blush/60 px-1 py-1.5 text-center">
              <span className="block font-heading text-xs font-bold text-primary">{s.value}</span>
              <span className="block text-[8.5px] text-muted-foreground">{s.label}</span>
            </span>
          ))}
        </div>

        {/* Guna Milan + Manglik */}
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <span className="rounded-lg border border-gold/30 bg-gold/10 px-1 py-1.5 text-center">
            <span className="block font-heading text-xs font-bold text-gold-muted">32/36</span>
            <span className="block text-[8.5px] text-muted-foreground">Guna Milan</span>
          </span>
          <span className="rounded-lg border border-border-light bg-surface-muted px-1 py-1.5 text-center">
            <span className="block font-heading text-xs font-bold text-foreground/80">No</span>
            <span className="block text-[8.5px] text-muted-foreground">Manglik</span>
          </span>
        </div>
      </div>
    </div>
  );
}
