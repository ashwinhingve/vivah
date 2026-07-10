import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import AnimatedSection from './AnimatedSection.client';
import { Eyebrow } from './Ornament';

// ── Visual A: Reciprocal Matching — Venn diagram ──────────────────────────────
function ReciprocalVenn() {
  return (
    <div className="relative w-full max-w-[360px] mx-auto select-none" aria-hidden="true">
      <svg viewBox="0 0 360 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
        {/* Left circle — Profile A */}
        <circle cx="140" cy="120" r="90" fill="color-mix(in srgb, var(--color-primary) 10%, transparent)" stroke="var(--color-primary)" strokeWidth="1.5" />
        {/* Right circle — Profile B */}
        <circle cx="220" cy="120" r="90" fill="color-mix(in srgb, var(--color-teal) 10%, transparent)" stroke="var(--color-teal)" strokeWidth="1.5" />
        {/* Overlap fill — mutual zone */}
        <path
          d="M180 48.6 A90 90 0 0 1 180 191.4 A90 90 0 0 1 180 48.6 Z"
          fill="color-mix(in srgb, var(--color-gold) 28%, transparent)"
          stroke="var(--color-gold)"
          strokeWidth="1.5"
          opacity="0.95"
        />
        {/* Gold heart at the top of the mutual zone */}
        <path
          d="M180 76 c3.5-4.5 10-2.5 10 3 c0 4.5-6.5 8-10 11.5 c-3.5-3.5-10-7-10-11.5 c0-5.5 6.5-7.5 10-3 Z"
          fill="var(--color-gold)"
          opacity="0.9"
        />
        {/* Left label */}
        <text x="110" y="110" textAnchor="middle" fill="var(--color-primary)" fontFamily="var(--font-heading), serif" fontSize="11" fontWeight="600">Profile</text>
        <text x="110" y="126" textAnchor="middle" fill="var(--color-primary)" fontFamily="var(--font-heading), serif" fontSize="11" fontWeight="600">A</text>
        {/* Right label */}
        <text x="250" y="110" textAnchor="middle" fill="var(--color-teal)" fontFamily="var(--font-heading), serif" fontSize="11" fontWeight="600">Profile</text>
        <text x="250" y="126" textAnchor="middle" fill="var(--color-teal)" fontFamily="var(--font-heading), serif" fontSize="11" fontWeight="600">B</text>
        {/* Center callout */}
        <text x="180" y="115" textAnchor="middle" fill="var(--color-gold-muted)" fontFamily="var(--font-heading), serif" fontSize="10" fontWeight="700">Both</text>
        <text x="180" y="130" textAnchor="middle" fill="var(--color-gold-muted)" fontFamily="var(--font-heading), serif" fontSize="10" fontWeight="700">Accept</text>
      </svg>
      {/* Callout chip */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-3 flex items-center gap-2 bg-surface border border-gold/30 rounded-full px-4 py-2 shadow-card text-xs font-semibold text-gold-muted">
        <span className="w-2 h-2 rounded-full bg-gold" />
        Mutual interest required · No one-sided reveals
      </div>
    </div>
  );
}

// ── Visual B: Guna Milan — 8-factor bars ─────────────────────────────────────
const gunaFactors = [
  { name: 'Varna', score: 1, max: 1 },
  { name: 'Vashya', score: 2, max: 2 },
  { name: 'Tara', score: 3, max: 3 },
  { name: 'Yoni', score: 3, max: 4 },
  { name: 'Graha Maitri', score: 5, max: 5 },
  { name: 'Gana', score: 5, max: 6 },
  { name: 'Bhakoot', score: 6, max: 7 },
  { name: 'Nadi', score: 8, max: 8 },
];

function GunaMilanBars() {
  const total = gunaFactors.reduce((s, f) => s + f.score, 0);
  const maxTotal = gunaFactors.reduce((s, f) => s + f.max, 0);

  return (
    <div
      className="w-full max-w-[360px] mx-auto rounded-2xl border border-gold/20 bg-surface shadow-card p-6"
      aria-label={`Guna Milan compatibility: ${total} out of ${maxTotal}`}
    >
      <div className="flex justify-between items-center border-b border-gold/20 pb-3 mb-4">
        <p className="text-sm font-semibold text-foreground font-heading">
          Guna Milan Score
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-primary font-heading">
            {total}
          </span>
          <span className="text-sm text-muted-foreground">/ {maxTotal}</span>
        </div>
      </div>

      <div className="space-y-2.5" aria-hidden="true">
        {gunaFactors.map((f) => (
          <div key={f.name} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0 truncate">{f.name}</span>
            <div className="flex-1 h-2 rounded-full bg-blush/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-primary transition-all"
                style={{ width: `${(f.score / f.max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right">{f.score}/{f.max}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-center text-muted-foreground">
        <span aria-hidden="true" className="h-1 w-1 rotate-45 rounded-[1px] bg-gold/70" />
        Excellent match · Mangal Dosha: None
        <span aria-hidden="true" className="h-1 w-1 rotate-45 rounded-[1px] bg-gold/70" />
      </p>
    </div>
  );
}

// ── Visual C: Wedding Planner — Card mock ────────────────────────────────────
interface PlannerTask {
  label: string;
  done: boolean;
  category: string;
}

const plannerTasks: PlannerTask[] = [
  { label: 'Book Mandap Decorator', done: true, category: 'Vendor' },
  { label: 'Confirm Guest List — 280 guests', done: true, category: 'Guests' },
  { label: 'Catering Menu Review', done: false, category: 'Catering' },
  { label: 'Send RSVP Invitations', done: false, category: 'Invites' },
];

function WeddingPlannerMock() {
  return (
    <div
      className="w-full max-w-[360px] mx-auto rounded-2xl border border-gold/20 bg-surface shadow-card overflow-hidden"
      aria-label="Wedding planning dashboard preview"
      aria-hidden="true"
    >
      {/* Header strip */}
      <div className="bg-primary px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">
            Wedding · Jun 2027
          </p>
          <p className="text-white font-heading font-semibold text-base mt-0.5">
            Priya &amp; Arjun
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/70">Budget used</p>
          <p className="text-white font-bold text-lg">68%</p>
        </div>
      </div>

      {/* Budget bar */}
      <div className="px-5 pt-4 pb-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[68%] rounded-full bg-gold" />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">₹8.2L spent</span>
          <span className="text-xs text-muted-foreground">₹12L total</span>
        </div>
      </div>

      {/* Task list */}
      <div className="px-5 pb-5 pt-3 space-y-2.5">
        {plannerTasks.map((task) => (
          <div key={task.label} className="flex items-center gap-3">
            <div
              className={[
                'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border',
                task.done
                  ? 'bg-teal border-teal'
                  : 'border-border bg-background',
              ].join(' ')}
            >
              {task.done && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span
              className={[
                'text-sm flex-1 truncate',
                task.done ? 'line-through text-muted-foreground' : 'text-foreground',
              ].join(' ')}
            >
              {task.label}
            </span>
            <span className="text-[10px] rounded-full border border-border px-2 py-0.5 text-muted-foreground flex-shrink-0">
              {task.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature data ──────────────────────────────────────────────────────────────
interface FeatureShowcase {
  eyebrow: string;
  heading: string;
  body: string;
  bullets: string[];
  visual: ReactNode;
  reversed: boolean;
}

const features: FeatureShowcase[] = [
  {
    eyebrow: 'Reciprocal Matching',
    heading: 'Matching that respects\nboth sides',
    body: 'No one-sided revelations. Contact details, photos, and profile details only unlock when BOTH parties show genuine interest. Your dignity is protected by design.',
    bullets: [
      'Photos stay blurred until mutual interest',
      'Silent decline — they never know you passed',
      'Family members can co-review matches',
    ],
    visual: <ReciprocalVenn />,
    reversed: false,
  },
  {
    eyebrow: 'Guna Milan',
    heading: 'Vedic compatibility,\ndone right',
    body: 'Full 8-factor Ashtakoot analysis with real Vedic calculations — not approximations. Includes Mangal Dosha detection and an explainable per-factor breakdown both families can understand.',
    bullets: [
      'All 8 Ashtakoot factors calculated',
      'Mangal Dosha detection built in',
      'AI narrative explains the score in plain language',
    ],
    visual: <GunaMilanBars />,
    reversed: true,
  },
  {
    eyebrow: 'Wedding Planning',
    heading: 'Everything in one\nplatform',
    body: 'From the first match to the mandap — budget tracking, vendor booking with escrow payments, guest list management, and RSVP — all seamlessly connected to your match journey.',
    bullets: [
      'Verified vendors with escrow-protected payments',
      'Guest list, invitations, and RSVP in one place',
      'Budget tracker with category breakdowns',
    ],
    visual: <WeddingPlannerMock />,
    reversed: false,
  },
];

// ── Section ───────────────────────────────────────────────────────────────────
export default async function FeaturesGrid() {
  const t = await getTranslations('marketing.features');

  const headingMap: Record<string, string> = {
    'Reciprocal Matching': t('reciprocalHeading'),
    'Guna Milan':          t('gunaHeading'),
    'Wedding Planning':    t('weddingHeading'),
  };

  return (
    <section id="features" className="bg-background py-24 md:py-28">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 space-y-28 md:space-y-36">
        {features.map((f) => (
          <AnimatedSection
            key={f.eyebrow}
            delay={0}
            direction={f.reversed ? 'right' : 'left'}
          >
            <div
              className={[
                'grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center',
                f.reversed ? 'lg:[&>*:first-child]:order-2' : '',
              ].join(' ')}
            >
              {/* Text column */}
              <div>
                <Eyebrow align="left" className="mb-3">{f.eyebrow}</Eyebrow>
                <h2
                  className="font-heading font-semibold text-foreground leading-[1.12] whitespace-pre-line"
                  style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.5rem)' }}
                >
                  {headingMap[f.eyebrow] ?? f.heading}
                </h2>
                <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-lg">
                  {f.body}
                </p>
                <ul className="mt-6 space-y-3">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm text-foreground/80">
                      <span
                        className="mt-0.5 w-5 h-5 rounded-full bg-teal/10 ring-1 ring-teal/30 flex items-center justify-center flex-shrink-0"
                        aria-hidden="true"
                      >
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="var(--color-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual column */}
              <div className="flex items-center justify-center py-4">
                {f.visual}
              </div>
            </div>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}
