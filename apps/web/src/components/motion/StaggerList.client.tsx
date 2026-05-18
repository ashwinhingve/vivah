'use client';

import { Children, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
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
