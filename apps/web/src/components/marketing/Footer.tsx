import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Instagram, Twitter, Facebook, Youtube, Heart, MapPin } from 'lucide-react';
import { LogoWhite } from './Logo';

interface FooterLink {
  label: string;
  href: string;
  disabled?: boolean;
  labelKey?: string;
}

interface FooterColumn {
  headingKey: string;
  links: FooterLink[];
}

const columns: FooterColumn[] = [
  {
    headingKey: 'companyHeading',
    links: [
      { label: 'About Us', href: '#', disabled: true },
      { label: 'Careers', href: '#', disabled: true },
      { label: 'Press Kit', href: '#', disabled: true },
      { label: 'Contact Support', labelKey: 'contactSupport', href: 'mailto:support@smartshaadi.co.in' },
    ],
  },
  {
    headingKey: 'productHeading',
    links: [
      { label: 'How it Works', href: '#how-it-works' },
      { label: 'For Individuals', href: '/register' },
      { label: 'For Families', href: '/register?mode=family' },
      { label: 'Browse Vendors', href: '/vendors' },
      { label: 'Success Stories', href: '#', disabled: true },
    ],
  },
  {
    headingKey: 'resourcesHeading',
    links: [
      { label: 'AI Matchmaking', href: '#features' },
      { label: 'Guna Milan Guide', href: '#features' },
      { label: 'Safety Mode', href: '#for-families' },
      { label: 'Wedding Checklist', href: '#', disabled: true },
      { label: 'Help Centre', href: '/help' },
    ],
  },
  {
    headingKey: 'legalHeading',
    links: [
      { label: 'Privacy Policy', href: '#', disabled: true },
      { label: 'Terms of Service', href: '#', disabled: true },
      { label: 'Refund Policy', href: '#', disabled: true },
      { label: 'Cookie Policy', href: '#', disabled: true },
    ],
  },
];

const socialLinks = [
  { Icon: Instagram, label: 'Smart Shaadi on Instagram', href: '#' },
  { Icon: Twitter, label: 'Smart Shaadi on Twitter / X', href: '#' },
  { Icon: Facebook, label: 'Smart Shaadi on Facebook', href: '#' },
  { Icon: Youtube, label: 'Smart Shaadi on YouTube', href: '#' },
];

function renderLink(link: FooterLink, label: string) {
  const baseClass =
    'text-sm transition-colors min-h-[44px] inline-flex items-center leading-none text-text-on-dark/50 hover:text-gold';

  if (link.disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${baseClass} opacity-40 cursor-default hover:text-text-on-dark/50`}
      >
        {label}
      </span>
    );
  }

  if (link.href.startsWith('#') || link.href.startsWith('mailto:')) {
    return (
      <a href={link.href} className={baseClass}>
        {label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={baseClass}>
      {label}
    </Link>
  );
}

export default async function Footer() {
  const t = await getTranslations('marketing.footer');

  return (
    <footer className="relative bg-dark-surface pt-16 pb-8">
      {/* Thin gold gradient line at the top */}
      <div
        aria-hidden="true"
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
      />

      <div className="max-w-screen-xl mx-auto px-4 md:px-6">
        {/* Main grid — brand left + 4 link columns right */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 md:gap-10">

          {/* Brand column — spans 2 on desktop */}
          <div className="col-span-2">
            <LogoWhite size={28} />
            <p className="mt-4 text-sm text-text-on-dark/50 max-w-[220px] leading-relaxed">
              India&apos;s AI-powered matrimonial platform. Family-trusted.
              Privacy-first.
            </p>

            {/* Social icons */}
            <div className="flex gap-2 mt-6" role="list" aria-label="Social media links">
              {socialLinks.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  role="listitem"
                  className="w-11 h-11 rounded-full border border-text-on-dark/10 hover:border-gold/40 bg-dark-elevated hover:bg-dark-elevated/80 flex items-center justify-center transition-all duration-200 text-text-on-dark/50 hover:text-gold"
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.headingKey}>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-text-on-dark/40 mb-4">
                {t(col.headingKey)}
              </h3>
              <ul className="space-y-1">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {renderLink(link, link.labelKey ? t(link.labelKey) : link.label)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="border-t border-text-on-dark/10 mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-text-on-dark/40">
            {t('copyright')}
          </p>

          {/* Made in India badge */}
          <span className="inline-flex items-center gap-1.5 text-xs text-text-on-dark/40 border border-text-on-dark/10 rounded-full px-3 py-1.5">
            <MapPin className="w-3 h-3 text-gold/60 flex-shrink-0" aria-hidden="true" />
            Made in India with
            <Heart className="w-3 h-3 text-gold/70 flex-shrink-0" aria-hidden="true" />
            for Indian families
          </span>

          <p className="text-xs text-text-on-dark/30 hidden sm:block">
            MCA21 · DLT Registered · ISO 27001 Compliant
          </p>
        </div>
      </div>
    </footer>
  );
}
