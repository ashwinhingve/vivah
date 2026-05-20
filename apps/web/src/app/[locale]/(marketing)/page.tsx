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

const isDemoMode = process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true';

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="pt-16">
        <Hero />
        <StatsBar />
        <HowItWorks />
        <FeaturesGrid />
        <TrustSection />
        <Testimonials />
        {!isDemoMode && <Pricing />}
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
