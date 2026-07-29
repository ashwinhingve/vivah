import type { ReactNode } from 'react';
import Navbar from '@/components/marketing/Navbar.client';
import Footer from '@/components/marketing/Footer';

/**
 * Public marketing-adjacent pages (programmatic SEO landings, help centre,
 * community pages) share the marketing chrome: the floating Navbar + Footer.
 * The top padding clears the fixed navbar pill (~76px) so each page's own
 * header isn't tucked underneath it — matching the per-page pattern the
 * (marketing) pages use with `pt-16` on their <main>.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16 md:pt-20">{children}</div>
      <Footer />
    </>
  );
}
