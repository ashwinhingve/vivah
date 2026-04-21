import Link from 'next/link';
import { Check } from 'lucide-react';

const freeFeatures = [
  'Create complete profile',
  'View 5 matches per day',
  'Basic Guna Milan score',
  'Send 3 interests per week',
  'Safety Mode included',
];

const premiumFeatures = [
  'Unlimited daily matches',
  'Full 8-factor Guna Milan breakdown',
  'Send unlimited interests',
  'AI Conversation Coach',
  'Family Compatibility Mode',
  'Video calls & private chat',
  'Priority support',
  'Wedding planning suite (coming soon)',
];

function PaisleyOrnament({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.6">
        <circle cx="50" cy="50" r="40" />
        <circle cx="50" cy="50" r="30" />
        <circle cx="50" cy="50" r="20" />
        <circle cx="50" cy="50" r="10" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 12;
          const x = 50 + Math.cos(angle) * 40;
          const y = 50 + Math.sin(angle) * 40;
          return <line key={i} x1="50" y1="50" x2={x} y2={y} />;
        })}
      </g>
    </svg>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="bg-background py-24 md:py-28">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6">
        <p
          aria-hidden="true"
          className="text-xs font-semibold uppercase tracking-widest text-primary/70 text-center mb-3"
        >
          Pricing
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center text-foreground mb-4 font-[family-name:var(--font-heading)]">
          Start Free.{' '}
          <span className="italic text-primary">Upgrade When Ready.</span>
        </h2>
        <p className="text-muted-foreground text-center mb-16 leading-relaxed">
          No credit card. No auto-charges. Cancel anytime.
        </p>

        <div className="flex flex-col md:flex-row gap-6 max-w-3xl mx-auto items-stretch">
          {/* FREE CARD */}
          <article className="relative overflow-hidden bg-surface border border-border rounded-3xl p-8 flex-1 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300">
            <PaisleyOrnament className="absolute -top-8 -right-8 w-32 h-32 text-gold/15 pointer-events-none" />

            <p className="relative text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Free Forever
            </p>
            <p className="relative text-5xl md:text-6xl font-bold text-foreground font-[family-name:var(--font-heading)] mt-2">
              ₹0
            </p>
            <p className="relative text-sm text-gold-muted mt-1">
              No credit card required
            </p>

            <ul className="relative space-y-3 mt-8 flex-1">
              {freeFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 text-sm text-foreground"
                >
                  <Check
                    className="w-4 h-4 text-teal flex-shrink-0"
                    aria-hidden="true"
                  />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="relative inline-flex items-center justify-center w-full mt-10 border border-primary text-primary hover:bg-primary hover:text-white font-semibold rounded-lg px-6 py-3.5 min-h-[48px] transition-all duration-200"
            >
              Get Started Free
            </Link>
          </article>

          {/* PREMIUM CARD */}
          <article className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-primary rounded-3xl p-8 flex-1 flex flex-col shadow-2xl shadow-primary/30 md:scale-105">
            <span className="absolute -top-px left-1/2 -translate-x-1/2 bg-gold text-primary text-xs font-bold px-5 py-1.5 rounded-b-xl whitespace-nowrap shadow-md">
              Most Popular
            </span>

            <PaisleyOrnament className="absolute -bottom-12 -right-12 w-48 h-48 text-gold/20 pointer-events-none" />
            <span
              aria-hidden="true"
              className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-gold/10 pointer-events-none"
            />

            <p className="relative text-sm text-gold/90 uppercase tracking-wide mt-4 font-semibold">
              Smart Shaadi Premium
            </p>
            <p className="relative mt-2">
              <span className="text-5xl md:text-6xl font-bold text-white font-[family-name:var(--font-heading)]">
                ₹999
              </span>
              <span className="text-lg text-gold/70 ml-1">/month</span>
            </p>
            <p className="relative text-sm text-gold/80 mt-1">
              ₹2,499 for 3 months (save 17%)
            </p>

            <ul className="relative space-y-3 mt-8 flex-1">
              {premiumFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 text-sm text-white/95"
                >
                  <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                    <Check
                      className="w-3 h-3 text-peach"
                      aria-hidden="true"
                    />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/register?plan=premium"
              className="relative inline-flex items-center justify-center w-full mt-10 bg-surface text-primary font-semibold rounded-lg px-6 py-4 min-h-[52px] hover:bg-surface/95 transition-all duration-200 shadow-xl shadow-black/20 hover:-translate-y-0.5"
            >
              Start 7-Day Free Trial →
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
