import type { ReactNode } from 'react';
import Navbar from '@/components/marketing/Navbar.client';
import Footer from '@/components/marketing/Footer';

/**
 * Legal pages (privacy, terms, refund, cookie) get the same marketing chrome
 * as the public pages: floating Navbar + Footer, with top padding to clear the
 * fixed navbar pill. Previously these rendered bare, with no way back to the
 * site.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16 md:pt-20">{children}</div>
      <Footer />
    </>
  );
}
