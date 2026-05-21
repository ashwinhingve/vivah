import { getTranslations } from 'next-intl/server';
import AnimatedSection from './AnimatedSection.client';
import { NoMatchesIllustration } from '@/components/ui/illustrations';

interface Step {
  number: string;
  titleKey: string;
  description: string;
  tags: string[];
}

const steps: Step[] = [
  {
    number: '01',
    titleKey: 'step1Title',
    description:
      'Set up in 2 minutes. Aadhaar-verified identity, horoscope details, family background, and lifestyle preferences — all with full privacy control. Family members can co-create.',
    tags: ['KYC Verified', 'Family Mode', 'Kundli Upload'],
  },
  {
    number: '02',
    titleKey: 'step2Title',
    description:
      'Our AI analyses Guna Milan scores, lifestyle alignment, and family values. Reciprocal matching means both sides must show interest before contact details unlock — no awkward one-sided reveals.',
    tags: ['Guna Milan Score', 'Reciprocal Matching', 'Daily Suggestions'],
  },
  {
    number: '03',
    titleKey: 'step3Title',
    description:
      'Once connected, move seamlessly to the wedding journey: vendor discovery, budget tracking, guest list, and RSVP — all in one platform built for Indian families.',
    tags: ['Vendor Marketplace', 'Budget Planner', 'Guest List & RSVP'],
  },
];

export default async function HowItWorks() {
  const t = await getTranslations('marketing.howItWorks');

  return (
    <section id="how-it-works" className="bg-surface py-24 md:py-28">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6">

        {/* Section header */}
        <AnimatedSection className="text-center mb-16">
          <p
            aria-hidden="true"
            className="text-xs font-semibold uppercase tracking-widest text-gold-muted mb-3"
          >
            How it Works
          </p>
          <h2
            className="font-[family-name:var(--font-heading)] font-semibold text-foreground"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 3rem)' }}
          >
            {t('sectionHeading')}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Designed for both individuals and families. Start together, find together.
          </p>
        </AnimatedSection>

        {/* Steps grid — stacks vertically on mobile, 3-col on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, idx) => (
            <AnimatedSection key={step.number} delay={idx * 0.1}>
              <article className="relative group flex flex-col rounded-2xl border border-gold/20 bg-background p-7 shadow-card hover:shadow-card-hover hover:border-gold/40 transition-all duration-300 hover:-translate-y-1 h-full">

                {/* Connector line between cards (desktop only) */}
                {idx < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="hidden md:block absolute top-10 -right-4 w-8 h-px bg-gold/30 z-10"
                  />
                )}

                {/* Numbered circle */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-gold/15 ring-1 ring-gold/30"
                    aria-hidden="true"
                  >
                    <span className="font-[family-name:var(--font-heading)] font-bold text-lg text-primary leading-none">
                      {step.number}
                    </span>
                  </div>
                  {/* Decorative faded step bg number */}
                  <span
                    aria-hidden="true"
                    className="absolute top-4 right-5 text-7xl font-bold leading-none text-primary/[0.04] font-[family-name:var(--font-heading)] pointer-events-none select-none"
                  >
                    {step.number}
                  </span>
                </div>

                <h3
                  className="font-[family-name:var(--font-heading)] font-medium text-primary mb-3"
                  style={{ fontSize: 'clamp(1.1rem, 1.5vw, 1.35rem)' }}
                >
                  {t(step.titleKey)}
                </h3>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {step.description}
                </p>

                {/* Illustration on middle card */}
                {idx === 1 && (
                  <div className="my-4 flex justify-center opacity-60">
                    <NoMatchesIllustration className="w-16 h-16" />
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-5">
                  {step.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs rounded-full border border-border bg-surface px-3 py-1 text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
