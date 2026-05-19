'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from '@/lib/motion-config';

interface Props {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function FadeUp({ children, delay = 0, className }: Props) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : MOTION.fade.y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.fade.duration, delay, ease: MOTION.fade.ease }}
    >
      {children}
    </motion.div>
  );
}
