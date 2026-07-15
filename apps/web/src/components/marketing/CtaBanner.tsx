import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Eyebrow } from './Ornament';
import coupleDusk from '../../../public/landing/couple-dusk.webp';

export default async function CtaBanner() {
  const t = await getTranslations('marketing.cta');
  return (
    <section
      id="cta"
      className="relative isolate overflow-hidden py-24 md:py-32"
      aria-label="Get started with Smart Shaadi"
    >
      {/* Full-bleed dusk photo under a plum wash — the page's descent into dusk */}
      <Image
        src={coupleDusk}
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        quality={80}
        className="-z-20 object-cover"
        style={{ objectPosition: '50% 30%' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg,' +
            ' color-mix(in srgb, var(--color-plum) 88%, transparent) 0%,' +
            ' color-mix(in srgb, var(--color-plum) 62%, transparent) 45%,' +
            ' color-mix(in srgb, var(--color-plum) 90%, transparent) 100%)',
        }}
      />

      {/* Gold hairlines top + bottom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
      />

      <div className="relative max-w-2xl mx-auto px-4 text-center">
        <Eyebrow tone="dark" className="mb-5">
          {t('eyebrow')}
        </Eyebrow>

        <h2
          className="font-heading font-semibold text-white leading-[1.1] [text-shadow:_0_2px_20px_rgba(0,0,0,0.35)]"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
        >
          {t('heading')}
        </h2>

        <p className="mt-6 text-white/85 leading-relaxed text-base md:text-lg max-w-lg mx-auto [text-shadow:_0_1px_8px_rgba(0,0,0,0.35)]">
          {t('body')}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center min-h-[52px] rounded-xl px-9 py-3.5 bg-surface text-primary font-semibold text-base transition-all duration-200 shadow-lg shadow-black/30 hover:bg-background hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-plum"
          >
            <span className="inline-flex items-center gap-2">
              {t('primaryCta')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
          <a
            href="mailto:support@smartshaadi.co.in"
            className="inline-flex items-center justify-center min-h-[52px] rounded-xl px-9 py-3.5 border border-gold/50 text-white font-semibold text-base transition-all duration-200 backdrop-blur-sm hover:border-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-plum"
          >
            {t('secondaryCta')}
          </a>
        </div>

        <p className="mt-6 text-white/60 text-sm">
          {t('microcopy')}
        </p>
      </div>
    </section>
  );
}
