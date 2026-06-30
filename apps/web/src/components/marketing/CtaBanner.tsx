import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
export default async function CtaBanner() {
  const t = await getTranslations('marketing.cta');
  return (
    <section
      id="cta"
      className="relative isolate overflow-hidden py-24 md:py-32"
      aria-label="Get started with Smart Shaadi"
    >
      {/* Token-based burgundy gradient — no image dependency */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 60%, color-mix(in srgb, var(--color-primary-hover) 80%, var(--color-dark-bg)) 100%)',
        }}
      />

      {/* Subtle gold radial glow — top left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse, color-mix(in srgb, var(--color-gold) 15%, transparent) 0%, transparent 70%)',
        }}
      />
      {/* Subtle gold radial glow — bottom right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -right-16 w-64 h-64 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse, color-mix(in srgb, var(--color-gold) 10%, transparent) 0%, transparent 70%)',
        }}
      />

      {/* Decorative circles */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-8 right-16 w-32 h-32 rounded-full border border-surface/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 left-16 w-20 h-20 rounded-full border border-surface/10"
      />

      <div className="relative max-w-2xl mx-auto px-4 text-center">
        <p
          aria-hidden="true"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80 mb-5"
        >
          {t('eyebrow')}
        </p>

        <h2
          className="font-heading font-semibold text-white leading-[1.1]"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
        >
          {t('heading')}
        </h2>

        <p className="mt-6 text-white/85 leading-relaxed text-base md:text-lg max-w-lg mx-auto">
          {t('body')}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center min-h-[52px] rounded-lg px-9 py-3.5 bg-teal text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-black/25 hover:bg-teal-hover hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            {t('primaryCta')}
          </Link>
          <a
            href="mailto:support@smartshaadi.co.in"
            className="inline-flex items-center justify-center min-h-[52px] rounded-lg px-9 py-3.5 border-2 border-surface/30 text-white font-semibold text-base transition-all duration-200 backdrop-blur-sm hover:border-surface/60 hover:bg-surface/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
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
