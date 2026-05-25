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
  /** Format the running value for display (e.g. add %, commas). */
  format?: (n: number) => string;
  /** When true, render as `${Math.round(n)}%` regardless of `format`. Kept as a
   * serializable boolean (not a function) so this component stays usable from
   * server-component parents — function props cannot cross the RSC boundary. */
  percent?: boolean;
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
  format = (n) => Math.round(n).toLocaleString('en-IN'),
  percent = false,
  className,
}: AnimatedNumberProps) {
  const formatFn = percent ? (n: number) => `${Math.round(n)}%` : format;
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

  return (
    <span ref={node} className={className}>
      {formatFn(display)}
    </span>
  );
}
