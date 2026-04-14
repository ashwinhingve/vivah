'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { LogoFull, LogoWhite } from './Logo';

const navLinks = [
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'For Families', href: '#for-families' },
  { label: 'Features', href: '#features' },
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

  // Scroll-aware bg: transparent over hero, white/blur after scroll
  useEffect(() => {
    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 80);
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
    ? 'bg-white/90 backdrop-blur-md border-b border-[#E8E0D8] shadow-sm'
    : 'bg-transparent border-b border-transparent';

  const linkClass = scrolled
    ? 'text-sm text-[#2E2E38] hover:text-[#7B2D42] transition-colors'
    : 'text-sm text-white/90 hover:text-white transition-colors [text-shadow:_0_1px_8px_rgba(0,0,0,0.3)]';

  const loginClass = scrolled
    ? 'text-sm text-[#6B6B76] hover:text-[#2E2E38] transition-colors'
    : 'text-sm text-white/90 hover:text-white transition-colors [text-shadow:_0_1px_8px_rgba(0,0,0,0.3)]';

  const vendorsClass = scrolled
    ? 'text-sm text-[#2E2E38] opacity-50 cursor-default'
    : 'text-sm text-white/60 cursor-default [text-shadow:_0_1px_8px_rgba(0,0,0,0.3)]';

  const hamburgerClass = scrolled ? 'text-[#2E2E38]' : 'text-white drop-shadow-md';

  const betaPillClass = scrolled
    ? 'ml-2 text-[8px] font-bold tracking-widest bg-[#C5A47E]/20 text-[#9E7F5A] rounded-full px-2 py-0.5 uppercase'
    : 'ml-2 text-[8px] font-bold tracking-widest bg-white/20 backdrop-blur-sm text-white rounded-full px-2 py-0.5 uppercase border border-white/30';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${headerClass}`}
      >
        <nav
          aria-label="Primary"
          className="max-w-screen-xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between"
        >
          <div className="flex items-center">
            <Link
              href="/"
              aria-label="Smart Shaadi home"
              className="flex items-center min-h-[44px]"
            >
              {scrolled ? <LogoFull /> : <LogoWhite />}
            </Link>
            <span className={betaPillClass}>Beta</span>
          </div>

          <ul className="hidden md:flex gap-6 items-center">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <span aria-disabled="true" className={vendorsClass}>
                Vendors
              </span>
            </li>
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className={`${loginClass} min-h-[44px] flex items-center px-2`}
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-[#0E7C7B] hover:bg-[#149998] text-white font-semibold text-sm rounded-lg px-4 py-2 min-h-[44px] flex items-center transition-all duration-200 shadow-md shadow-[#0E7C7B]/30 hover:shadow-lg hover:shadow-[#0E7C7B]/40"
            >
              Register Free
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            className={`md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center ${hamburgerClass}`}
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
        </nav>
      </header>

      {isOpen ? (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-50 bg-white flex flex-col md:hidden"
        >
          <div className="h-16 px-4 border-b border-[#E8E0D8] flex items-center justify-between">
            <LogoFull />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation menu"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#2E2E38]"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <ul className="flex-1 flex flex-col justify-center px-8">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="py-5 border-b border-[#E8E0D8] text-2xl font-semibold text-[#7B2D42] block w-full font-[family-name:var(--font-heading)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="px-8 pb-10">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center text-center text-[#6B6B76] mb-4 min-h-[44px]"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center justify-center text-center bg-[#0E7C7B] hover:bg-[#149998] text-white font-semibold text-lg rounded-lg py-4 min-h-[44px] transition-colors duration-200"
            >
              Register Free →
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
