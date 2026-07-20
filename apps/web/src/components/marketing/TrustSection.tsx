import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { ArrowRight, Check } from 'lucide-react';
import { Eyebrow } from './Ornament';
import AnimatedSection from './AnimatedSection.client';
import coupleDusk from '../../../public/landing/couple-dusk.webp';
import floralIvory from '../../../public/landing/floral-ivory.webp';

export default async function TrustSection() {
  const t = await getTranslations('marketing.trust');
  const individualPoints = t.raw('individualsPoints') as string[];
  const familyPoints = t.raw('familiesPoints') as string[];

  return (
    <section id="for-families" className="grid grid-cols-1 lg:grid-cols-2">
      {/* LEFT — For Individuals (burgundy-overlaid bride photo) */}
      <div className="relative isolate min-h-[600px] lg:min-h-[680px] flex items-center">
        <Image
          src={coupleDusk}
          alt="Couple in wedding attire overlooking a lit palace lake at dusk"
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          quality={80}
          className="object-cover object-center -z-20"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-br from-plum/95 via-primary/85 to-primary-hover/80"
        />

        <AnimatedSection
          direction="left"
          className="relative w-full max-w-[640px] ml-auto px-8 md:px-12 py-20 md:py-24"
        >
          <Eyebrow tone="dark" align="left" className="mb-3">
            {t('individualsEyebrow')}
          </Eyebrow>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white font-heading leading-tight [text-shadow:_0_2px_16px_rgba(0,0,0,0.3)]">
            {t('individualsHeading')}
          </h2>
          <p className="text-white/85 mt-6 leading-relaxed text-base [text-shadow:_0_1px_8px_rgba(0,0,0,0.3)]">
            {t('individualsBody')}
          </p>

          <ul className="mt-8 space-y-4">
            {individualPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-gold/30 ring-1 ring-gold/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check
                    className="w-4 h-4 text-peach"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-white/95 text-sm md:text-base [text-shadow:_0_1px_6px_rgba(0,0,0,0.3)]">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/register"
            className="inline-flex items-center justify-center bg-surface text-primary font-semibold rounded-lg px-7 py-3.5 mt-10 min-h-[48px] hover:bg-surface/95 transition-all duration-200 shadow-xl shadow-black/20 hover:-translate-y-0.5"
          >
            <span className="inline-flex items-center gap-2">
              {t('individualsCta')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </AnimatedSection>
      </div>

      {/* RIGHT — For Families (ivory-washed family photo) */}
      <div className="relative isolate min-h-[600px] lg:min-h-[680px] flex items-center">
        <Image
          src={floralIvory}
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          quality={80}
          className="object-cover object-center -z-20"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-bl from-background/85 via-background/72 to-surface/60"
        />

        <AnimatedSection
          direction="right"
          className="relative w-full max-w-[640px] mr-auto px-8 md:px-12 py-20 md:py-24"
        >
          <Eyebrow align="left" className="mb-3">
            {t('familiesEyebrow')}
          </Eyebrow>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-primary font-heading leading-tight">
            {t('familiesHeading')}
          </h2>
          <p className="text-foreground mt-6 leading-relaxed text-base">
            {t('familiesBody')}
          </p>

          <ul className="mt-8 space-y-4">
            {familyPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-teal/15 ring-1 ring-teal/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check
                    className="w-4 h-4 text-teal"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-foreground text-sm md:text-base">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/register?mode=family"
            className="inline-flex items-center justify-center bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-7 py-3.5 mt-10 min-h-[48px] transition-all duration-200 shadow-lg shadow-teal/30 hover:shadow-xl hover:shadow-teal/40 hover:-translate-y-0.5"
          >
            <span className="inline-flex items-center gap-2">
              {t('familiesCta')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
