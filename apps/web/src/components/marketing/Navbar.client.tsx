'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Menu, X } from 'lucide-react';
import { LogoFull } from './Logo';

interface NavLink {
  label: string;
  href: string;
}

const navLinks: NavLink[] = [
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'For Families', href: '#for-families' },
  { label: 'Features', href: '#features' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Lock body scroll + Escape close while mobile menu is open
  useEffect(() => {
    if (!isOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // Scroll-aware bg: transparent over hero (ivory), surface/blur after scroll
  useEffect(() => {
    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 72);
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const headerClass = scrolled
    ? 'bg-surface/92 backdrop-blur-md border-b border-border shadow-sm'
    : 'bg-background/80 backdrop-blur-sm border-b border-transparent';

  const linkClass = scrolled
    ? 'text-sm text-foreground/80 hover:text-primary transition-colors duration-150'
    : 'text-sm text-foreground/70 hover:text-primary transition-colors duration-150';

  const loginClass = scrolled
    ? 'text-sm text-muted-foreground hover:text-foreground transition-colors duration-150'
    : 'text-sm text-foreground/60 hover:text-foreground transition-colors duration-150';

  const hamburgerClass = scrolled ? 'text-foreground' : 'text-foreground/70';

  const betaPillClass = scrolled
    ? 'ml-2 text-[8px] font-bold tracking-widest bg-gold/15 text-gold-muted rounded-full px-2 py-0.5 uppercase'
    : 'ml-2 text-[8px] font-bold tracking-widest bg-primary/10 text-primary rounded-full px-2 py-0.5 uppercase';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${headerClass}`}
      >
        <nav
          aria-label="Primary navigation"
          className="max-w-screen-xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between"
        >
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              aria-label="Smart Shaadi home"
              className="flex items-center min-h-[44px]"
            >
              {/* Use LogoFull in both states — no white logo needed on ivory bg */}
              <LogoFull />
            </Link>
            <span className={betaPillClass} aria-label="Beta version">Beta</span>
          </div>

          {/* Desktop nav links */}
          <ul className="hidden md:flex gap-6 items-center" role="list">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('#') ? (
                  <a
                    href={link.href}
                    className={`${linkClass} min-h-[44px] inline-flex items-center`}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className={`${linkClass} min-h-[44px] inline-flex items-center`}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className={`${loginClass} min-h-[44px] flex items-center px-2`}
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center min-h-[44px] bg-teal hover:bg-teal-hover text-white font-semibold text-sm rounded-lg px-5 py-2 transition-all duration-200 shadow-sm shadow-teal/20 hover:shadow-md hover:shadow-teal/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              Register Free
            </Link>
          </div>

          {/* Hamburger — mobile */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            className={`md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${hamburgerClass} hover:bg-foreground/5`}
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
        </nav>
      </header>

      {/* Mobile menu — full-screen overlay */}
      {isOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-50 bg-surface flex flex-col md:hidden"
        >
          {/* Top bar */}
          <div className="h-16 px-4 border-b border-border flex items-center justify-between">
            <LogoFull />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation menu"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          {/* Nav links */}
          <ul className="flex-1 flex flex-col justify-center px-8" role="list">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('#') ? (
                  <a
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="py-5 border-b border-border text-2xl font-semibold text-primary block w-full font-[family-name:var(--font-heading)] hover:text-primary-hover transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="py-5 border-b border-border text-2xl font-semibold text-primary block w-full font-[family-name:var(--font-heading)] hover:text-primary-hover transition-colors"
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Bottom CTA area */}
          <div className="px-8 pb-10 space-y-3">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center text-center text-muted-foreground hover:text-foreground min-h-[44px] transition-colors"
            >
              Already have an account? Login
            </Link>
            <Link
              href="/register"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center justify-center text-center bg-teal hover:bg-teal-hover text-white font-semibold text-lg rounded-xl py-4 min-h-[52px] transition-colors duration-200 shadow-md shadow-teal/20"
            >
              Register Free →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
