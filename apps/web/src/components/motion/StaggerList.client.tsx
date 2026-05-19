'use client';

import { Children, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { MOTION } from '@/lib/motion-config';

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: MOTION.stagger.childDelay } },
};

const item: Variants = {
  hidden: { opacity: 0, y: MOTION.stagger.item.y },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION.stagger.item.duration, ease: MOTION.stagger.item.ease },
  },
};

interface StaggerListProps {
  children: ReactNode;
  className?: string;
}

/**
 * Staggers direct children in by 40ms each (fade + 4px slide-up).
 * Renders children plainly under prefers-reduced-motion.
 */
export function StaggerList({ children, className }: StaggerListProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={container}
    >
      {Children.map(children, (child, i) => (
        <motion.div key={i} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
