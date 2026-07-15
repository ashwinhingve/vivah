import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Navbar from '@/components/marketing/Navbar.client';
import Hero from '@/components/marketing/Hero.client';
import StatsBar from '@/components/marketing/StatsBar.client';
import HowItWorks from '@/components/marketing/HowItWorks';
import FeaturesGrid from '@/components/marketing/FeaturesGrid';
import TrustSection from '@/components/marketing/TrustSection';
import Testimonials from '@/components/marketing/Testimonials';
import Pricing from '@/components/marketing/Pricing';
import CtaBanner from '@/components/marketing/CtaBanner';
import Footer from '@/components/marketing/Footer';
import { SectionDivider } from '@/components/ui/SectionDivider';

const isDemoMode = process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.landing.metadata' });
  const title = t('title');
  const description = t('description');
  const path = locale === 'hi' ? '/hi' : '/';
  return {
    title,
    description,
    // The one public, indexable entry point.
    robots: { index: true, follow: true },
    alternates: {
      canonical: path,
      languages: { 'en-IN': '/', 'hi-IN': '/hi' },
    },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website',
      siteName: 'Smart Shaadi',
      locale: locale === 'hi' ? 'hi_IN' : 'en_IN',
      images: ['/og-default.svg'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-default.svg'],
    },
  };
}

export default function LandingPage() {
  return (
    <>
      <Navbar />
      {/* No top padding: the hero's floral backdrop flows under the floating navbar */}
      <main id="main-content">
        <Hero />
        <StatsBar />

        {/* Rhythm band 1 */}
        <div className="bg-primary/[0.02]">
          <HowItWorks />
        </div>

        {/* Divider after HowItWorks */}
        <SectionDivider />

        {/* Features & Trust grid (natural ivory → images → white → ivory alternation) */}
        <FeaturesGrid />
        <TrustSection />

        {/* Divider after TrustSection */}
        <SectionDivider />

        {/* Rhythm band 2 */}
        <div className="bg-gold/[0.03]">
          <Testimonials />
        </div>

        {/* Divider after Testimonials */}
        <SectionDivider />

        {!isDemoMode && <Pricing />}
        <CtaBanner />
      </main>

      {/* Divider before Footer */}
      <SectionDivider className="bg-plum/5 px-4" />

      <Footer />
    </>
  );
}
