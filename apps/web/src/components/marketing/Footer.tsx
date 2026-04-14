import Link from 'next/link';
import { Instagram, Twitter, Facebook, Youtube, Heart } from 'lucide-react';
import { LogoWhite } from './Logo';

type FooterLink = { label: string; href: string; disabled?: boolean };

const platformLinks: FooterLink[] = [
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'For Individuals', href: '/register' },
  { label: 'For Families', href: '/register?mode=family' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Success Stories', href: '#', disabled: true },
];

const featureLinks: FooterLink[] = [
  { label: 'AI Matchmaking', href: '#features' },
  { label: 'Guna Milan Calculator', href: '#features' },
  { label: 'Safety Mode', href: '#for-families' },
  { label: 'Wedding Planning', href: '#features' },
  { label: 'Vendor Marketplace', href: '#features' },
];

const companyLinks: FooterLink[] = [
  { label: 'About Us', href: '#', disabled: true },
  { label: 'Privacy Policy', href: '#', disabled: true },
  { label: 'Terms of Service', href: '#', disabled: true },
  { label: 'Contact', href: '#', disabled: true },
  { label: 'Careers', href: '#', disabled: true },
];

const socialIcons = [
  { Icon: Instagram, label: 'Instagram' },
  { Icon: Twitter, label: 'Twitter' },
  { Icon: Facebook, label: 'Facebook' },
  { Icon: Youtube, label: 'YouTube' },
];

function renderLink(link: FooterLink) {
  const className =
    'text-[#9090A0] text-sm hover:text-white transition-colors min-h-[44px] inline-flex items-center';

  if (link.disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${className} opacity-60 cursor-default`}
      >
        {link.label}
      </span>
    );
  }

  if (link.href.startsWith('#')) {
    return (
      <a href={link.href} className={className}>
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

export default function Footer() {
  return (
    <footer className="relative bg-[#2E2E38] pt-16 pb-8">
      {/* Thin gold gradient line at the very top */}
      <div
        aria-hidden="true"
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C5A47E]/60 to-transparent"
      />
      <div className="max-w-screen-xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <LogoWhite />
            <p className="text-[#9090A0] text-sm mt-4 max-w-[220px] leading-relaxed">
              India&apos;s AI-Powered Matrimonial Platform
            </p>
            <div className="flex gap-3 mt-6">
              {socialIcons.map(({ Icon, label }) => (
                <span
                  key={label}
                  role="link"
                  tabIndex={0}
                  aria-label={label}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Icon
                    className="w-4 h-4 text-white/60"
                    aria-hidden="true"
                  />
                </span>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-4">
              Platform
            </h3>
            <ul className="space-y-2">
              {platformLinks.map((l) => (
                <li key={l.label}>{renderLink(l)}</li>
              ))}
            </ul>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-4">
              Features
            </h3>
            <ul className="space-y-2">
              {featureLinks.map((l) => (
                <li key={l.label}>{renderLink(l)}</li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-4">
              Company
            </h3>
            <ul className="space-y-2">
              {companyLinks.map((l) => (
                <li key={l.label}>{renderLink(l)}</li>
              ))}
            </ul>
            <span className="inline-block mt-6 bg-white/10 text-white/50 text-xs rounded-full px-3 py-1.5">
              App Coming Soon
            </span>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[#6B6B76] text-xs">
            © 2026 Smart Shaadi. All rights reserved.
          </p>
          <p className="text-[#6B6B76] text-xs flex items-center">
            Made with
            <Heart
              className="inline w-3 h-3 text-[#C5A47E] mx-1"
              aria-hidden="true"
            />
            for Indian families
          </p>
        </div>
      </div>
    </footer>
  );
}
