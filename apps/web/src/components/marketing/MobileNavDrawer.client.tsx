'use client';

import { useState, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LogoFull } from './Logo';
import { LanguageToggle } from '@/components/i18n/LanguageToggle.client';
import {
  PLAIN_LINKS_BEFORE,
  PLAIN_LINKS_AFTER,
  FEATURES_MENU,
  BROWSE_MENU,
  type MarketingMenuItem,
  type MarketingNavLink,
} from './nav-links';

/**
 * Mobile marketing menu — right-side drawer on the Sheet primitive (focus trap,
 * scroll lock, Escape and backdrop close come from Radix Dialog). Replaces the
 * old full-screen overlay. Controlled state so link taps close the drawer.
 */
export function MobileNavDrawer() {
  const t = useTranslations('marketing.navbar');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/5 md:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-[85vw] max-w-[360px] flex-col gap-0 rounded-l-2xl border-l border-gold/25 p-0 md:hidden"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>

        {/* Header — SheetContent renders its own top-right close button */}
        <div className="flex h-16 shrink-0 items-center border-b border-gold/20 px-5">
          <LogoFull />
        </div>

        {/* Scrollable groups */}
        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <DrawerPlainRow link={PLAIN_LINKS_BEFORE[0]!} label={t('howItWorks')} onNavigate={close} />

          <DrawerGroup title={t('features')}>
            {FEATURES_MENU.map((item) => (
              <DrawerMenuRow
                key={item.labelKey}
                item={item}
                label={t(`menu.${item.labelKey}`)}
                onNavigate={close}
              />
            ))}
          </DrawerGroup>

          <DrawerGroup title={t('browse')}>
            {BROWSE_MENU.map((item) => (
              <DrawerMenuRow
                key={item.labelKey}
                item={item}
                label={item.labelKey === 'vendors' ? t('vendors') : t(`menu.${item.labelKey}`)}
                onNavigate={close}
              />
            ))}
          </DrawerGroup>

          <div className="mt-4">
            <DrawerPlainRow link={PLAIN_LINKS_AFTER[0]!} label={t('pricing')} onNavigate={close} />
          </div>
        </nav>

        {/* Pinned CTA footer — pb clears the demo-mode chip + home indicator */}
        <div className="shrink-0 space-y-2.5 border-t border-gold/20 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
          <div className="flex justify-center pb-1">
            <LanguageToggle />
          </div>
          <Link
            href="/login"
            onClick={close}
            className="flex min-h-[44px] items-center justify-center rounded-xl border border-gold/35 bg-gold/5 font-medium text-primary transition-colors hover:bg-gold/15"
          >
            {t('login')}
          </Link>
          <Link
            href="/register"
            onClick={close}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary text-center font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-hover"
          >
            {t('register')}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="px-3 pb-1 text-2xs font-semibold uppercase tracking-widest text-gold-muted">
        {title}
      </h3>
      <ul role="list">{children}</ul>
    </section>
  );
}

function DrawerMenuRow({
  item,
  label,
  onNavigate,
}: {
  item: MarketingMenuItem;
  label: string;
  onNavigate: () => void;
}) {
  const { Icon } = item;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-primary"
          aria-hidden="true"
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </Link>
    </li>
  );
}

function DrawerPlainRow({
  link,
  label,
  onNavigate,
}: {
  link: MarketingNavLink;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className="flex min-h-[48px] items-center rounded-xl px-3 font-heading text-base font-semibold text-primary transition-colors hover:bg-gold/10"
    >
      {label}
    </Link>
  );
}
