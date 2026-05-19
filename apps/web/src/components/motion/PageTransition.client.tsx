'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { MOTION } from '@/lib/motion-config';

/** Fade + slide-up on mount (canonical timing in lib/motion-config). */
export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0, y: MOTION.page.y },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION.page.duration, ease: MOTION.page.ease },
  },
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
          ? {
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { duration: MOTION.reduced.duration } },
            }
          : pageTransitionVariants
      }
    >
      {children}
    </motion.div>
  );
}
