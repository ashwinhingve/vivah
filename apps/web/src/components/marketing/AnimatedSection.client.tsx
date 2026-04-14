'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type AnimatedSectionProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  id?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
  direction?: 'up' | 'left' | 'right';
};

export default function AnimatedSection({
  children,
  delay = 0,
  className,
  id,
  as = 'div',
  direction = 'up',
}: AnimatedSectionProps) {
  const reduce = useReducedMotion();

  const offset =
    direction === 'left'
      ? { x: -32, y: 0 }
      : direction === 'right'
      ? { x: 32, y: 0 }
      : { x: 0, y: 24 };

  const initial = reduce ? false : { opacity: 0, ...offset };
  const whileInView = reduce ? undefined : { opacity: 1, x: 0, y: 0 };

  const props = {
    initial,
    whileInView,
    viewport: { once: true, margin: '-80px' } as const,
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
    className,
    id,
  };

  if (as === 'section') return <motion.section {...props}>{children}</motion.section>;
  if (as === 'article') return <motion.article {...props}>{children}</motion.article>;
  if (as === 'aside') return <motion.aside {...props}>{children}</motion.aside>;
  return <motion.div {...props}>{children}</motion.div>;
}
