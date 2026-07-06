'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { ShieldCheck, Heart } from 'lucide-react';
import { HERO_PROFILES } from './heroCarouselData';

const ROTATE_MS = 4200;
const STACK_DEPTH = 3;
const EASE = [0.16, 1, 0.3, 1] as const;

/** Per-depth transform for the fanned 3D card stack (front = index 0). */
const DEPTH_STYLE = [
  { x: 0, y: 0, z: 0, rotateZ: 0, scale: 1, opacity: 1 },
  { x: 22, y: 16, z: -70, rotateZ: 3.5, scale: 0.945, opacity: 0.6 },
  { x: 42, y: 30, z: -130, rotateZ: 7, scale: 0.89, opacity: 0.32 },
] as const;

/**
 * The marketing hero's signature: a fanned, pointer-tilted 3D stack of AI
 * portrait cards, anchored by a live Guna-Milan compatibility badge built from
 * real per-profile scores. Photos ship with burned-in overlay typography; this
 * component adds depth, tilt, a verified chip, and the compatibility badge.
 * All motion is gated behind `prefers-reduced-motion` and touch devices.
 */
export function HeroCarousel() {
  const t = useTranslations('landing');
  const reduce = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(true);
  const [canTilt, setCanTilt] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Pointer-driven tilt (desktop, fine pointer, motion allowed).
  const px = useMotionValue(0); // -0.5 .. 0.5
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-12, 12]), {
    stiffness: 140,
    damping: 18,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanTilt(mq.matches && !reduce);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [reduce]);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { threshold: 0.25 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || hovered || !inView) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % HERO_PROFILES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [reduce, hovered, inView]);

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!canTilt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function resetTilt() {
    px.set(0);
    py.set(0);
  }

  const active = HERO_PROFILES[activeIdx]!;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative flex w-full flex-col items-center gap-5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        resetTilt();
      }}
    >
      {/* Soft gold glow behind the stack — radial gradient, no blur filter */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 50% 42%,' +
            ' color-mix(in srgb, var(--color-gold) 22%, transparent) 0%,' +
            ' color-mix(in srgb, var(--color-primary) 8%, transparent) 38%,' +
            ' transparent 68%)',
        }}
      />

      <div
        className="relative w-full max-w-[248px] sm:max-w-[300px] lg:max-w-[340px]"
        style={{ perspective: 1200 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Example profile: ${active.name}`}
        aria-live="polite"
      >
        <motion.div
          className="relative aspect-[4/5] w-full"
          style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        >
          {Array.from({ length: STACK_DEPTH }).map((_, depth) => {
            const idx = (activeIdx + depth) % HERO_PROFILES.length;
            const profile = HERO_PROFILES[idx]!;
            const front = depth === 0;
            const d = DEPTH_STYLE[depth]!;
            return (
              <motion.div
                key={`${profile.id}-${depth}`}
                className="absolute inset-0 overflow-hidden rounded-3xl shadow-card-hover ring-1 ring-gold/30"
                initial={false}
                animate={{
                  x: d.x,
                  y: d.y,
                  z: d.z,
                  rotateZ: d.rotateZ,
                  scale: d.scale,
                  opacity: d.opacity,
                }}
                transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
                style={{
                  zIndex: STACK_DEPTH - depth,
                  transformStyle: 'preserve-3d',
                  pointerEvents: front ? 'auto' : 'none',
                }}
                aria-hidden={!front}
              >
                <Image
                  src={profile.photoUrl}
                  alt={`${profile.name}, ${profile.profession} in ${profile.city}`}
                  fill
                  sizes="(max-width: 768px) 80vw, 340px"
                  priority={profile.id === HERO_PROFILES[0]!.id}
                  className="object-cover"
                />
                {front && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/3"
                    style={{
                      background:
                        'linear-gradient(to top, color-mix(in srgb, var(--color-primary) 42%, transparent), transparent)',
                    }}
                  />
                )}
              </motion.div>
            );
          })}

          {/* Verified chip — top-right, popped forward */}
          <div
            className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-teal shadow-card ring-1 ring-teal/20 backdrop-blur-sm"
            style={{ transform: 'translateZ(50px)' }}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('compat.verified')}
          </div>

          {/* Compatibility badge — the signature; floats forward, updates per profile */}
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="pointer-events-none absolute -left-3 bottom-6 z-20 rounded-2xl bg-surface/95 px-3.5 py-2.5 shadow-gold-glow ring-1 ring-gold/40 backdrop-blur-sm"
            style={{ transform: 'translateZ(70px)' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-4 w-4 text-primary" aria-hidden="true" fill="currentColor" />
              </span>
              <div className="leading-tight">
                <p className="font-heading text-lg font-bold text-primary">
                  {active.compatibilityScore}%{' '}
                  <span className="text-xs font-medium text-foreground/60">{t('compat.match')}</span>
                </p>
                <p className="text-[11px] font-medium text-teal">
                  {t('compat.guna')} {active.gunaScore}/36
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Dots */}
      <div className="relative z-10 flex gap-2" role="tablist" aria-label="Browse example profiles">
        {HERO_PROFILES.map((p, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show profile ${i + 1} of ${HERO_PROFILES.length}`}
              onClick={() => setActiveIdx(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                isActive ? 'w-6 bg-gold' : 'w-2 bg-gold/30 hover:bg-gold/60'
              }`}
            />
          );
        })}
      </div>

      <p className="relative z-10 mt-1 text-center text-xs italic text-muted-foreground">
        {t('aiDisclosure')}
      </p>
    </motion.div>
  );
}
