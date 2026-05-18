'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

/** Fade + 8px slide-up on mount, 200ms ease-out. Reuse the variants if needed. */
export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/** Wrap a page's content. No-op transform under prefers-reduced-motion. */
export function PageTransition({ children, className }: PageTransitionProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={
        reduce
          ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.15 } } }
          : pageTransitionVariants
      }
    >
      {children}
    </motion.div>
  );
}
