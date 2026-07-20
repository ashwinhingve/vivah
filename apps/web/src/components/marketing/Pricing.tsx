import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Check } from 'lucide-react';
import { PLANS_CONSTANT, monthlySavings } from '@smartshaadi/types';
import { Eyebrow } from './Ornament';

/**
 * Prices are derived from PLANS_CONSTANT (packages/types/src/plans.ts), the
 * declared single source of truth that apps/api, packages/db and the billing
 * page all read from. This section used to hard-code ₹999 and ₹2,499, making
 * it an untested fourth copy — exactly the sync hazard apps/api/src/payments/
 * plans.test.ts warns about ("a price change was made to only one source").
 * Deriving them means a plan price change cannot silently leave the public
 * pricing page advertising a stale number.
 */
const premiumMonthly = PLANS_CONSTANT.find((p) => p.code === 'PREMIUM_M');
const premiumQuarterly = PLANS_CONSTANT.find((p) => p.code === 'PREMIUM_Q');

const inr = (amount: string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.parseFloat(amount));

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

export default async function Pricing() {
  const t = await getTranslations('marketing.pricing');
  const freeFeatures = t.raw('freeFeatures') as string[];
  const premiumFeatures = t.raw('premiumFeatures') as string[];

  const savings =
    premiumQuarterly && monthlySavings(premiumQuarterly, PLANS_CONSTANT);

  return (
    <section id="pricing" className="bg-background py-24 md:py-28">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6">
        <Eyebrow className="mb-3">{t('eyebrow')}</Eyebrow>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center text-foreground mb-4 font-heading">
          {t('sectionHeading')}
        </h2>
        <p className="text-muted-foreground text-center mb-16 leading-relaxed">
          {t('subtext')}
        </p>

        <div className="flex flex-col md:flex-row gap-6 max-w-3xl mx-auto items-stretch">
          {/* FREE CARD */}
          <article className="relative overflow-hidden bg-surface border border-border rounded-3xl p-8 flex-1 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300">
            <PaisleyOrnament className="absolute -top-8 -right-8 w-32 h-32 text-gold/15 pointer-events-none" />

            <p className="relative text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('freePlanName')}
            </p>
            <p className="relative text-5xl md:text-6xl font-bold text-foreground font-heading mt-2">
              {inr('0')}
            </p>
            <p className="relative text-sm text-gold-muted mt-1">
              {t('freePriceNote')}
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
              {t('freeCta')}
            </Link>
          </article>

          {/* PREMIUM CARD */}
          <article className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-primary rounded-3xl p-8 flex-1 flex flex-col shadow-2xl shadow-primary/30 md:scale-105">
            {/* text-plum, not text-primary: burgundy #7B2D42 on gold #C5A47E is
                3.91:1, under the 4.5:1 WCAG AA floor for 12px bold. Plum
                #421B2E on the same gold clears it comfortably. */}
            <span className="absolute -top-px left-1/2 -translate-x-1/2 bg-gold text-plum text-xs font-bold px-5 py-1.5 rounded-b-xl whitespace-nowrap shadow-md">
              {t('mostPopular')}
            </span>

            <PaisleyOrnament className="absolute -bottom-12 -right-12 w-48 h-48 text-gold/20 pointer-events-none" />
            <span
              aria-hidden="true"
              className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-gold/10 pointer-events-none"
            />

            <p className="relative text-sm text-gold/90 uppercase tracking-wide mt-4 font-semibold">
              {t('premiumPlanName')}
            </p>
            <p className="relative mt-2">
              <span className="text-5xl md:text-6xl font-bold text-white font-heading">
                {premiumMonthly ? inr(premiumMonthly.amount) : null}
              </span>
              <span className="text-lg text-gold/70 ml-1">{t('perMonth')}</span>
            </p>
            {premiumQuarterly && savings ? (
              <p className="relative text-sm text-gold/80 mt-1">
                {t('quarterlyNote', {
                  amount: inr(premiumQuarterly.amount),
                  percent: savings.percent,
                })}
              </p>
            ) : null}

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
              {t('premiumCta')}
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
