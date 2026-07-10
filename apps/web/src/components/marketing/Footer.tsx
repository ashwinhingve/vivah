import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Instagram, Twitter, Facebook, Youtube, Heart, MapPin, ShieldCheck, Lock, Headphones } from 'lucide-react';
import { LogoWhite } from './Logo';
import { HeadingRule } from './Ornament';
import mandapDusk from '../../../public/landing/mandap-dusk.webp';

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
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
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
    'text-sm transition-colors min-h-[44px] inline-flex items-center leading-none text-text-on-dark/55 hover:text-gold';

  if (link.disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${baseClass} opacity-40 cursor-default hover:text-text-on-dark/55`}
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

  const trustItems = [
    { Icon: ShieldCheck, text: t('trustVerified') },
    { Icon: Lock, text: t('trustPrivacy') },
    { Icon: Headphones, text: t('trustSupport') },
  ];

  return (
    <footer className="relative bg-plum">
      {/* Dusk panorama band — the page's final descent into evening */}
      <div aria-hidden="true" className="relative h-28 overflow-hidden md:h-40">
        <Image
          src={mandapDusk}
          alt=""
          fill
          sizes="100vw"
          quality={80}
          className="object-cover"
          style={{ objectPosition: '50% 45%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%,' +
              ' color-mix(in srgb, var(--color-plum) 35%, transparent) 55%,' +
              ' var(--color-plum) 100%)',
          }}
        />
      </div>

      {/* Warm gold ambience inside the plum body */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-28 md:top-40"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 85% 10%, color-mix(in srgb, var(--color-gold) 7%, transparent) 0%, transparent 70%),' +
            ' radial-gradient(ellipse 50% 40% at 8% 90%, color-mix(in srgb, var(--color-primary) 30%, transparent) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-screen-xl px-4 pb-8 pt-12 md:px-6 md:pt-14">
        {/* Main grid — brand + 4 link columns + quote card */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-6 md:gap-10 xl:grid-cols-8">

          {/* Brand column */}
          <div className="col-span-2">
            <LogoWhite size={28} />
            <p className="mt-2.5 font-heading text-sm italic text-gold-light/90">
              {t('tagline')}
            </p>
            <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-text-on-dark/55">
              {t('description')}
            </p>

            {/* Social icons */}
            <div className="mt-6 flex gap-2" role="list" aria-label="Social media links">
              {socialLinks.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  role="listitem"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/20 bg-plum-elevated/70 text-text-on-dark/55 transition-all duration-200 hover:border-gold/50 hover:text-gold"
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.headingKey}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/90">
                {t(col.headingKey)}
              </h3>
              <HeadingRule className="mb-4" />
              <ul className="space-y-1">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {renderLink(link, link.labelKey ? t(link.labelKey) : link.label)}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Ornate quote card */}
          <div className="col-span-2 sm:col-span-3 md:col-span-6 xl:col-span-2">
            <div className="mx-auto max-w-[340px] rounded-xl border border-gold/40 p-1 xl:mx-0">
              <blockquote className="rounded-lg border border-gold/20 px-5 py-6 text-center">
                <span aria-hidden="true" className="block font-heading text-3xl leading-none text-gold">
                  &ldquo;
                </span>
                <p className="mt-1 font-heading text-base italic leading-relaxed text-peach">
                  {t('quote')}
                </p>
                <span aria-hidden="true" className="mt-4 flex items-center justify-center gap-2">
                  <span className="h-px w-8 bg-gold/40" />
                  <Heart className="h-3.5 w-3.5 text-gold/80" fill="currentColor" />
                  <span className="h-px w-8 bg-gold/40" />
                </span>
              </blockquote>
            </div>
          </div>
        </div>

        {/* Trust strip — honest, non-numeric */}
        <div className="mt-12 grid grid-cols-1 gap-4 border-t border-gold/15 pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map(({ Icon, text }) => (
            <span key={text} className="flex items-center justify-center gap-2.5 text-sm text-text-on-dark/65 lg:justify-start">
              <Icon className="h-4.5 w-4.5 flex-shrink-0 text-gold/80" aria-hidden="true" />
              {text}
            </span>
          ))}
          <span className="flex items-center justify-center gap-1.5 text-sm text-text-on-dark/65 lg:justify-start">
            <MapPin className="h-4.5 w-4.5 flex-shrink-0 text-gold/80" aria-hidden="true" />
            {t('trustMadeIn')}
            <Heart className="h-3.5 w-3.5 flex-shrink-0 text-gold/80" fill="currentColor" aria-hidden="true" />
          </span>
        </div>

        {/* Bottom strip */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-gold/15 pt-6 sm:flex-row">
          <p className="text-xs text-text-on-dark/45">
            {t('copyright')}
          </p>
          <p className="hidden text-xs text-text-on-dark/35 sm:block">
            MCA21 · DLT Registered · ISO 27001 Compliant
          </p>
        </div>
      </div>
    </footer>
  );
}
