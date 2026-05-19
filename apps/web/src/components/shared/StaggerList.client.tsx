'use client';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { MOTION } from '@/lib/motion-config';

// Canonical timing shared with components/motion/StaggerList (lib/motion-config).
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: MOTION.stagger.childDelay } },
};

export function StaggerList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : MOTION.stagger.item.y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: MOTION.stagger.item.duration, ease: MOTION.stagger.item.ease },
    },
  };
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="show">
      {React.Children.map(children, (child, i) => (
        <motion.div key={i} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
