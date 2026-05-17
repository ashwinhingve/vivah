'use client';
import { motion, useReducedMotion } from 'framer-motion';
import type { MatchFeedItem } from '@smartshaadi/types';
import { MatchCard } from './MatchCard';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export function AnimatedFeedGrid({ matches }: { matches: MatchFeedItem[] }) {
  const reduced = useReducedMotion();
  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 12 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
  };

  return (
    <motion.div
      role="feed"
      aria-busy="false"
      aria-label={`${matches.length} match suggestions`}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {matches.map((item) => (
        <motion.div key={item.profileId} variants={itemVariants}>
          <MatchCard match={item} />
        </motion.div>
      ))}
    </motion.div>
  );
}
