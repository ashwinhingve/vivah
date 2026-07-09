import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Navbar from '@/components/marketing/Navbar.client';
import Footer from '@/components/marketing/Footer';

/* DRAFT — PENDING REVIEW. Keep claims verifiable: no company-registration,
   member-count, or rating claims until they exist. */

interface Props {
  params: Promise<{ locale: string }>;
}

interface Section {
  heading: string;
  body: string[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.about' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.about' });
  const sections = t.raw('sections') as Section[];

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-background pt-16">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
          <header className="text-center">
            <p
              aria-hidden="true"
              className="text-xs font-semibold uppercase tracking-widest text-gold-muted mb-3"
            >
              {t('eyebrow')}
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-primary">
              {t('pageTitle')}
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">{t('intro')}</p>
          </header>

          <div className="mt-12 space-y-10">
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

          <div className="mt-14 text-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center min-h-[48px] rounded-lg px-8 py-3 bg-teal text-white font-semibold text-base transition-all duration-200 shadow-md shadow-teal/25 hover:bg-teal-hover hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              {t('cta')}
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('contact')}{' '}
              <a
                href="mailto:support@smartshaadi.co.in"
                className="text-teal hover:underline underline-offset-4"
              >
                support@smartshaadi.co.in
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
