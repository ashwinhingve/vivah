'use client';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
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
    hidden: { opacity: 0, y: reduced ? 0 : 10 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
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
