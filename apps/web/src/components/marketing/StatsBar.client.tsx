'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  animate,
} from 'framer-motion';

type Stat = {
  value: string;
  numericTarget?: number;
  suffix?: string;
  label: string;
};

const stats: Stat[] = [
  { value: 'Growing', label: 'Community of Verified Families' },
  {
    value: '94%',
    numericTarget: 94,
    suffix: '%',
    label: 'Match Satisfaction in Beta',
  },
  { value: '36-Point', label: 'Guna Milan AI Score' },
  { value: '2 Min', label: 'Average Profile Setup Time' },
];

function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  const motionValue = useMotionValue(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(target);
      return;
    }
    const controls = animate(motionValue, target, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, target, motionValue, reduce]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

export default function StatsBar() {
  const reduce = useReducedMotion();

  return (
    <section
      id="stats"
      className="relative isolate bg-gradient-to-br from-primary via-primary-hover to-primary py-14 md:py-16 overflow-hidden"
    >
      {/* Decorative paisley/mandala SVG pattern */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full opacity-[0.05] pointer-events-none -z-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="paisley"
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="40" cy="40" r="2" fill="#C5A47E" />
            <circle cx="0" cy="0" r="2" fill="#C5A47E" />
            <circle cx="80" cy="0" r="2" fill="#C5A47E" />
            <circle cx="0" cy="80" r="2" fill="#C5A47E" />
            <circle cx="80" cy="80" r="2" fill="#C5A47E" />
            <path
              d="M40 20 Q 50 30 40 40 Q 30 30 40 20 Z"
              fill="none"
              stroke="#C5A47E"
              strokeWidth="0.5"
            />
            <path
              d="M40 60 Q 50 50 40 40 Q 30 50 40 60 Z"
              fill="none"
              stroke="#C5A47E"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#paisley)" />
      </svg>

      <div className="relative max-w-screen-xl mx-auto px-4 md:px-6">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={
                i < stats.length - 1
                  ? 'md:border-r md:border-surface/15 md:pr-6 text-center md:text-left'
                  : 'text-center md:text-left'
              }
            >
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-3xl md:text-4xl lg:text-5xl font-bold text-white font-[family-name:var(--font-heading)]">
                {s.numericTarget !== undefined ? (
                  <CountUp target={s.numericTarget} suffix={s.suffix ?? ''} />
                ) : (
                  s.value
                )}
              </dd>
              <p
                className="text-xs md:text-sm text-gold mt-2 tracking-wide"
                aria-hidden="true"
              >
                {s.label}
              </p>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
}
