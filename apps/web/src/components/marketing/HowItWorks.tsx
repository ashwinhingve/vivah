import { getTranslations } from 'next-intl/server';
import AnimatedSection from './AnimatedSection.client';
import { NoMatchesIllustration } from '@/components/ui/illustrations';

interface Step {
  number: string;
  titleKey: string;
  descKey: string;
  tagsKey: string;
}

const steps: Step[] = [
  { number: '01', titleKey: 'step1Title', descKey: 'step1Desc', tagsKey: 'step1Tags' },
  { number: '02', titleKey: 'step2Title', descKey: 'step2Desc', tagsKey: 'step2Tags' },
  { number: '03', titleKey: 'step3Title', descKey: 'step3Desc', tagsKey: 'step3Tags' },
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
            {t('eyebrow')}
          </p>
          <h2
            className="font-heading font-semibold text-foreground"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 3rem)' }}
          >
            {t('sectionHeading')}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {t('subhead')}
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
                    <span className="font-heading font-bold text-lg text-primary leading-none">
                      {step.number}
                    </span>
                  </div>
                  {/* Decorative faded step bg number */}
                  <span
                    aria-hidden="true"
                    className="absolute top-4 right-5 text-7xl font-bold leading-none text-primary/[0.04] font-heading pointer-events-none select-none"
                  >
                    {step.number}
                  </span>
                </div>

                <h3
                  className="font-heading font-medium text-primary mb-3"
                  style={{ fontSize: 'clamp(1.1rem, 1.5vw, 1.35rem)' }}
                >
                  {t(step.titleKey)}
                </h3>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {t(step.descKey)}
                </p>

                {/* Illustration on middle card */}
                {idx === 1 && (
                  <div className="my-4 flex justify-center opacity-60">
                    <NoMatchesIllustration className="w-16 h-16" />
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-5">
                  {(t.raw(step.tagsKey) as string[]).map((tag) => (
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
