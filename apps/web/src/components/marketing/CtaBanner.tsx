import Link from 'next/link';
import Image from 'next/image';
import { CTA_BG } from '@/lib/marketing-images';

export default function CtaBanner() {
  return (
    <section id="cta" className="relative isolate py-24 md:py-32 overflow-hidden">
      {/* Full-bleed photo background */}
      <Image
        src={CTA_BG.src}
        alt={CTA_BG.alt}
        fill
        sizes="100vw"
        quality={80}
        className="object-cover object-center -z-20"
      />
      {/* Teal-tinted overlay so brand color reads through the photo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-teal/95 via-teal/85 to-teal/70"
      />
      {/* Decorative circles */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full bg-surface/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-surface/10"
      />

      <div className="relative max-w-2xl mx-auto px-4 text-center">
        <p
          aria-hidden="true"
          className="text-white/70 text-xs tracking-widest uppercase mb-4 font-semibold [text-shadow:_0_1px_8px_rgba(0,0,0,0.3)]"
        >
          India&apos;s Smartest Matrimonial Platform
        </p>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white font-[family-name:var(--font-heading)] [text-shadow:_0_2px_24px_rgba(0,0,0,0.4)]">
          Your Perfect Match
          <br />
          <span className="italic text-peach">is Waiting.</span>
        </h2>
        <p className="text-white/90 mt-6 leading-relaxed text-base md:text-lg [text-shadow:_0_1px_12px_rgba(0,0,0,0.4)]">
          Join our growing community of verified families. Free to join,
          private by default, family-first by design.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center bg-surface text-teal font-semibold rounded-lg px-8 py-4 min-h-[52px] hover:bg-surface/95 transition-all duration-200 shadow-xl shadow-black/20 hover:-translate-y-0.5"
          >
            Create Free Profile
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center border-2 border-surface/60 text-white rounded-lg px-8 py-4 min-h-[52px] hover:border-surface hover:bg-surface/10 transition-all duration-200 backdrop-blur-sm"
          >
            Learn More
          </a>
        </div>

        <p className="text-white/70 text-sm mt-6 [text-shadow:_0_1px_8px_rgba(0,0,0,0.3)]">
          No credit card · Free forever · 2-minute setup
        </p>
      </div>
    </section>
  );
}
