import { getTranslations } from 'next-intl/server';
import { Heart, Shield, Sparkles } from 'lucide-react';
import { MarkDivorceeOnboardingDone } from './DivorceeOnboarding.client';

interface Props {
  /** User's marital status (DIVORCED or WIDOWED). */
  maritalStatus: 'DIVORCED' | 'WIDOWED';
}

/**
 * Server component: warm, dignified onboarding for divorcees & widows.
 * Shows three key affirmations about privacy and confidence.
 * Completion is handled by a client button that calls the API.
 *
 * Tone: Confident, welcome, zero pity. This is a fresh start.
 */
export async function DivorceeOnboarding({ maritalStatus }: Props) {
  const t = await getTranslations('divorceeOnboarding');
  const isWidow = maritalStatus === 'WIDOWED';

  const steps = [
    {
      icon: Heart,
      title: isWidow ? t('step1WidowTitle') : t('step1DivorceeTitle'),
      message: isWidow
        ? t('step1WidowMessage')
        : t('step1DivorceeMessage'),
    },
    {
      icon: Shield,
      title: t('step2Title'),
      message: t('step2Message'),
    },
    {
      icon: Sparkles,
      title: t('step3Title'),
      message: t('step3Message'),
    },
  ];

  return (
    <section className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card">
      {/* Warm header */}
      <div className="border-b border-gold/15 bg-gradient-to-br from-primary/5 via-surface to-gold/5 px-6 py-6 text-center sm:text-left">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          {isWidow ? t('headerTitleWidow') : t('headerTitleDivorce')}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {isWidow
            ? t('headerSubtitleWidow')
            : t('headerSubtitleDivorce')}
        </p>
      </div>

      <div className="space-y-6 p-6">
        {/* Affirmation cards */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <div
                key={i}
                className="flex gap-4 rounded-lg border border-gold/20 bg-gradient-to-br from-gold/5 to-teal/5 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <StepIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-primary text-sm">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.message}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Complete button */}
        <MarkDivorceeOnboardingDone />

        {/* Trust note */}
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground sm:justify-start sm:text-left">
          <Shield className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
          <span>{t('trustNote')}</span>
        </p>
      </div>
    </section>
  );
}
