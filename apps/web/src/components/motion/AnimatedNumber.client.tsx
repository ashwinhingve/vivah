'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  /** Target value to count up to. */
  value: number;
  /** Animation duration in seconds. Default 1. */
  duration?: number;
  /** Format the running value for display (e.g. add %, commas). */
  format?: (n: number) => string;
  className?: string;
}

/**
 * Counts up from 0 to `value` on mount with an ease-out curve.
 * Respects prefers-reduced-motion (renders the final value immediately).
 */
export function AnimatedNumber({
  value,
  duration = 1,
  format = (n) => Math.round(n).toLocaleString('en-IN'),
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
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={node} className={className}>
      {format(display)}
    </span>
  );
}
