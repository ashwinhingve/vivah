'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Lock, Star, ChevronDown } from 'lucide-react';
import { HERO_BG } from '@/lib/marketing-images';

const avatars = [
  { initials: 'RS', bg: 'bg-[#7B2D42]/40', text: 'text-white' },
  { initials: 'KP', bg: 'bg-[#0E7C7B]/40', text: 'text-white' },
  { initials: 'AM', bg: 'bg-[#C5A47E]/40', text: 'text-white' },
  { initials: 'VP', bg: 'bg-[#7B2D42]/40', text: 'text-white' },
  { initials: 'NS', bg: 'bg-[#0E7C7B]/40', text: 'text-white' },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden min-h-[640px] md:min-h-[760px] lg:min-h-[820px] flex items-center"
    >
      {/* Background photo with slow Ken Burns zoom */}
      <motion.div
        className="absolute inset-0 -z-10"
        animate={reduce ? undefined : { scale: [1, 1.08] }}
        transition={
          reduce
            ? undefined
            : {
                duration: 24,
                ease: 'linear',
                repeat: Infinity,
                repeatType: 'reverse',
              }
        }
      >
        <Image
          src={HERO_BG.src}
          alt={HERO_BG.alt}
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover object-center"
        />
      </motion.div>

      {/* Dark left-heavy gradient for headline legibility */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/20"
      />
      {/* Warm burgundy bottom tint to bleed brand color */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#7B2D42]/35 via-transparent to-transparent"
      />

      {/* Foreground content */}
      <div className="relative w-full max-w-screen-xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="max-w-2xl"
        >
          <motion.p
            variants={itemVariants}
            aria-hidden="true"
            className="text-xs font-semibold uppercase tracking-widest text-white/80 border-l-2 border-[#C5A47E] pl-3 mb-6"
          >
            India&apos;s Most Trusted AI Matrimonial Platform
          </motion.p>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] text-white font-[family-name:var(--font-heading)] [text-shadow:_0_2px_24px_rgba(0,0,0,0.4)]"
          >
            Find Your Perfect
            <br />
            <span className="italic text-[#F4D9C2]">Life Partner</span>
            <br />
            With Your Family
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-6 text-base md:text-lg text-white/85 max-w-xl leading-relaxed [text-shadow:_0_1px_12px_rgba(0,0,0,0.4)]"
          >
            Smart Shaadi combines AI-powered compatibility matching with
            traditional family values. Guna Milan, horoscope matching, and
            verified profiles — all in one trusted platform.
          </motion.p>

          <motion.ul
            variants={itemVariants}
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2"
          >
            <li className="text-xs text-white/85 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#C5A47E]" aria-hidden="true" />
              Aadhaar Verified Profiles
            </li>
            <li className="text-xs text-white/85 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#C5A47E]" aria-hidden="true" />
              Safety Mode Enabled
            </li>
            <li className="text-xs text-white/85 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-[#C5A47E]" aria-hidden="true" />
              36-Point Guna Milan AI
            </li>
          </motion.ul>

          <motion.div
            variants={itemVariants}
            className="mt-10 flex flex-col sm:flex-row gap-3"
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center w-full sm:w-auto bg-[#0E7C7B] hover:bg-[#149998] text-white font-semibold rounded-lg px-8 py-4 text-base min-h-[52px] transition-all duration-200 shadow-lg shadow-[#0E7C7B]/30 hover:shadow-xl hover:shadow-[#0E7C7B]/40 hover:-translate-y-0.5"
            >
              Find Your Match →
            </Link>
            <Link
              href="/register?mode=family"
              className="inline-flex items-center justify-center w-full sm:w-auto border-2 border-white/70 text-white hover:bg-white/10 hover:border-white font-semibold rounded-lg px-8 py-4 text-base min-h-[52px] transition-all duration-200 backdrop-blur-sm"
            >
              For Parents &amp; Families
            </Link>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-xs text-white/60 mt-3"
          >
            Free to join · No credit card · 2 min setup
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-10 flex items-center gap-4"
          >
            <div className="flex -space-x-3">
              {avatars.map((a) => (
                <span
                  key={a.initials}
                  aria-hidden="true"
                  className={`w-11 h-11 rounded-full border-2 border-[#C5A47E] backdrop-blur-md flex items-center justify-center text-xs font-semibold ${a.bg} ${a.text}`}
                >
                  {a.initials}
                </span>
              ))}
            </div>
            <p className="text-sm text-white/80">
              Growing community of
              <br className="sm:hidden" /> verified families
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll affordance */}
      {!reduce ? (
        <motion.a
          href="#stats"
          aria-label="Scroll to next section"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
        >
          <ChevronDown className="w-6 h-6" aria-hidden="true" />
        </motion.a>
      ) : null}
    </section>
  );
}
