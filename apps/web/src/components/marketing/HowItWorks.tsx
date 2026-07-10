import { getTranslations } from 'next-intl/server';
import { UserRoundPlus, HeartHandshake, CalendarHeart, type LucideIcon } from 'lucide-react';
import AnimatedSection from './AnimatedSection.client';
import { Eyebrow } from './Ornament';

interface Step {
  number: string;
  titleKey: string;
  descKey: string;
  tagsKey: string;
  Icon: LucideIcon;
}

const steps: Step[] = [
  { number: '01', titleKey: 'step1Title', descKey: 'step1Desc', tagsKey: 'step1Tags', Icon: UserRoundPlus },
  { number: '02', titleKey: 'step2Title', descKey: 'step2Desc', tagsKey: 'step2Tags', Icon: HeartHandshake },
  { number: '03', titleKey: 'step3Title', descKey: 'step3Desc', tagsKey: 'step3Tags', Icon: CalendarHeart },
];

export default async function HowItWorks() {
  const t = await getTranslations('marketing.howItWorks');

  return (
    <section id="how-it-works" className="relative bg-surface py-24 md:py-28 overflow-hidden">
      {/* Soft blush wash behind the cards */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-1/3"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 100%, color-mix(in srgb, var(--color-blush) 55%, transparent) 0%, transparent 75%)',
        }}
      />

      <div className="relative max-w-screen-xl mx-auto px-4 md:px-6">

        {/* Section header */}
        <AnimatedSection className="text-center mb-16">
          <Eyebrow className="mb-3">{t('eyebrow')}</Eyebrow>
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

                {/* Dotted gold connector with diamond (desktop only) */}
                {idx < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="hidden md:flex absolute top-13 -right-8 lg:-right-10 w-8 lg:w-10 items-center z-10"
                  >
                    <span className="flex-1 border-t border-dashed border-gold/50" />
                    <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-gold/70 -ml-0.5" />
                  </div>
                )}

                {/* Icon medallion + number chip */}
                <div className="mb-5 flex items-start justify-between">
                  <div
                    className="flex h-13 w-13 items-center justify-center rounded-full bg-blush ring-1 ring-gold/40 transition-transform duration-300 group-hover:scale-105"
                    aria-hidden="true"
                  >
                    <step.Icon className="h-6 w-6 text-primary" strokeWidth={1.6} />
                  </div>
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/40 bg-surface font-heading text-xs font-bold text-gold-muted"
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

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-5">
                  {(t.raw(step.tagsKey) as string[]).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs rounded-full border border-gold/25 bg-surface px-3 py-1 text-muted-foreground"
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
