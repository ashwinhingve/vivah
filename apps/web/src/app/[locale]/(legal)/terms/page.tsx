import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ScrollText, Info } from 'lucide-react';

interface Props {
  params: Promise<{ locale: string }>;
}

interface Section {
  heading: string;
  body: string[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  const sections = t.raw('sections') as Section[];

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <ScrollText className="h-6 w-6 text-gold-muted" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-primary">
            {t('pageTitle')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t('lastUpdated')}</p>
        </header>

        <div
          role="note"
          className="mt-8 flex gap-3 rounded-2xl border border-gold/40 bg-surface p-4 text-sm leading-relaxed text-gold-muted shadow-card"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">{t('disclaimerTitle')}</strong>{' '}
            {t('disclaimerBody')}
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-heading text-xl font-semibold text-primary">
                {section.heading}
              </h2>
              <div className="mt-2 space-y-2">
                {section.body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
