'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { MOTION } from '@/lib/motion-config';

interface AnimatedNumberProps {
  /** Target value to count up to. */
  value: number;
  /** Animation duration in seconds. Default from motion-config. */
  duration?: number;
  /** Delay before starting the count, in seconds. Default 0. */
  delay?: number;
  /** When true, render as `${Math.round(n)}%`. */
  percent?: boolean;
  /** Prepended to the rendered number (e.g. `₹`). */
  prefix?: string;
  /** Appended to the rendered number (e.g. `/100`, ` km`). */
  suffix?: string;
  /** When set, renders this static string in place of the animation entirely.
   * Use for values that cannot be animated as plain numbers (e.g. currency
   * with locale grouping). The static text bypasses the tween. */
  staticValue?: string;
  className?: string;
}

/**
 * Counts up from 0 to `value` on mount with an ease-out curve.
 * Respects prefers-reduced-motion (renders the final value immediately).
 */
export function AnimatedNumber({
  value,
  duration = MOTION.numberSec,
  delay = 0,
  percent = false,
  prefix,
  suffix,
  staticValue,
  className,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const node = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      delay,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration, delay, reduce]);

  if (staticValue != null) {
    return <span ref={node} className={className}>{staticValue}</span>;
  }

  const body = percent
    ? `${Math.round(display)}%`
    : Math.round(display).toLocaleString('en-IN');

  return (
    <span ref={node} className={className}>
      {prefix}{body}{suffix}
    </span>
  );
}
