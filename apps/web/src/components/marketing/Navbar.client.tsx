'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { LogoFull } from './Logo';
import { LanguageToggle } from '@/components/i18n/LanguageToggle.client';

interface NavLink {
  labelKey: string;
  href: string;
}

const navLinks: NavLink[] = [
  { labelKey: 'howItWorks',  href: '#how-it-works' },
  { labelKey: 'forFamilies', href: '#for-families' },
  { labelKey: 'features',    href: '#features' },
  { labelKey: 'vendors',     href: '/vendors' },
  { labelKey: 'pricing',     href: '#pricing' },
];

/**
 * Desktop nav link. The underline is a scale-x wipe on a pseudo-element rather
 * than `text-decoration`, so it grows from the left edge instead of appearing
 * all at once. `motion-reduce:transition-none` keeps it instant for users who
 * have asked for less motion.
 */
const desktopLinkClass =
  'relative inline-flex min-h-[44px] items-center text-sm text-foreground/75 ' +
  'transition-colors duration-150 hover:text-primary ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2 focus-visible:rounded-sm ' +
  'after:pointer-events-none after:absolute after:bottom-2.5 after:left-0 after:h-px ' +
  'after:w-full after:origin-left after:scale-x-0 after:bg-primary ' +
  'after:transition-transform after:duration-200 after:ease-out ' +
  'hover:after:scale-x-100 motion-reduce:after:transition-none';

export default function Navbar() {
  const t = useTranslations('marketing.navbar');
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

  // Scroll-aware: the floating pill turns more opaque + compresses after scroll
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

  const pillClass = scrolled
    ? 'h-14 bg-surface/95 border-gold/30 shadow-[var(--shadow-lg)]'
    : 'h-16 bg-surface/75 border-white/70 shadow-[var(--shadow-md)]';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 px-3 pt-3 sm:px-4">
        {/*
          Desktop uses a 3-column grid rather than flex + justify-between: the
          logo and the auth-button cluster have different widths, so
          justify-between left the link list optically off-centre. `1fr auto 1fr`
          centres the links against the pill regardless of what flanks them.
          Mobile keeps the plain flex row (logo + hamburger only).
        */}
        <nav
          aria-label="Primary navigation"
          className={`mx-auto flex max-w-screen-xl items-center justify-between rounded-2xl border px-4 backdrop-blur-xl transition-all duration-300 md:grid md:grid-cols-[1fr_auto_1fr] md:px-6 ${pillClass}`}
        >
          {/* Logo */}
          <div className="flex items-center md:justify-self-start">
            <Link
              href="/"
              aria-label="Smart Shaadi home"
              className="flex items-center min-h-[44px]"
            >
              <LogoFull />
            </Link>
          </div>

          {/* Desktop nav links */}
          <ul className="hidden items-center gap-6 md:flex md:justify-self-center" role="list">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('#') ? (
                  <a
                    href={link.href}
                    className={desktopLinkClass}
                  >
                    {t(link.labelKey)}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className={desktopLinkClass}
                  >
                    {t(link.labelKey)}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop auth buttons */}
          <div className="hidden items-center gap-2.5 md:flex md:justify-self-end">
            <LanguageToggle />
            <Link
              href="/login"
              className="flex min-h-[40px] items-center rounded-lg border border-gold/35 bg-gold/5 px-4 text-sm font-medium text-primary transition-colors duration-150 hover:bg-gold/15"
            >
              {t('login')}
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-[40px] items-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('register')}
            </Link>
          </div>

          {/* Hamburger — mobile */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/5 md:hidden"
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
          className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
        >
          {/* Top bar */}
          <div className="flex h-16 items-center justify-between border-b border-gold/25 px-4">
            <LogoFull />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation menu"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground transition-colors hover:bg-foreground/5"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          {/* Nav links */}
          <ul className="flex flex-1 flex-col justify-center px-8" role="list">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('#') ? (
                  <a
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block w-full border-b border-border py-5 font-heading text-2xl font-semibold text-primary transition-colors hover:text-primary-hover"
                  >
                    {t(link.labelKey)}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block w-full border-b border-border py-5 font-heading text-2xl font-semibold text-primary transition-colors hover:text-primary-hover"
                  >
                    {t(link.labelKey)}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Bottom CTA area */}
          <div className="space-y-3 px-8 pb-10">
            <div className="flex justify-center pb-2">
              <LanguageToggle />
            </div>
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-gold/35 bg-gold/5 text-center font-medium text-primary transition-colors hover:bg-gold/15"
            >
              {t('login')}
            </Link>
            <Link
              href="/register"
              onClick={() => setIsOpen(false)}
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary py-4 text-center text-lg font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors duration-200 hover:bg-primary-hover"
            >
              {t('register')}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
