'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ProfileCard } from '@/components/ui/ProfileCard.client';
import { HERO_PROFILES } from './heroCarouselData';

const ROTATE_MS = 4000;
const STACK_DEPTH = 3;

/**
 * Auto-rotating stack of 3 mock profile cards used in the marketing hero.
 * - 4s rotation, pauses on hover (desktop) and when scrolled out of viewport.
 * - Cards behind the front are offset, scaled, and faded for depth.
 * - Each card uses the existing ProfileCard primitive with the initialed
 *   avatar fallback (no real photos).
 */
export function HeroCarousel() {
  const reduce = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-full flex-col items-center gap-4"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative h-[460px] w-full max-w-[320px]"
        role="region"
        aria-roledescription="carousel"
        aria-label={`Example profile: ${HERO_PROFILES[activeIdx]?.name ?? ''}`}
        aria-live="polite"
      >
        {Array.from({ length: STACK_DEPTH }).map((_, depth) => {
          const idx = (activeIdx + depth) % HERO_PROFILES.length;
          const profile = HERO_PROFILES[idx]!;
          const front = depth === 0;
          const offset = depth * 12;
          const scale = 1 - depth * 0.05;
          const opacity = depth === 0 ? 1 : depth === 1 ? 0.7 : 0.4;
          return (
            <motion.div
              key={`${profile.id}-${depth}`}
              className="absolute inset-0"
              initial={false}
              animate={{ x: offset, y: offset, scale, opacity }}
              transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ zIndex: STACK_DEPTH - depth, pointerEvents: front ? 'auto' : 'none' }}
              aria-hidden={!front}
            >
              <ProfileCard
                name={profile.name}
                age={profile.age}
                city={profile.city}
                profession={profile.profession}
                photoUrl={null}
                isVerified={profile.verified}
                compatibilityPct={profile.compatibilityScore}
                gunaScore={profile.gunaScore}
                className="h-full"
              />
            </motion.div>
          );
        })}
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Browse example profiles">
        {HERO_PROFILES.map((p, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Show profile ${i + 1} of ${HERO_PROFILES.length}`}
              onClick={() => setActiveIdx(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                active ? 'w-6 bg-gold' : 'w-2 bg-gold/30 hover:bg-gold/60'
              }`}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
