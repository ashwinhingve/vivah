'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LogoFull } from './Logo';
import { LanguageToggle } from '@/components/i18n/LanguageToggle.client';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { MobileNavDrawer } from './MobileNavDrawer.client';
import {
  PLAIN_LINKS_BEFORE,
  PLAIN_LINKS_AFTER,
  FEATURES_MENU,
  BROWSE_MENU,
  POPULAR_SEARCHES,
  type MarketingMenuItem,
} from './nav-links';

export default function Navbar() {
  const t = useTranslations('marketing.navbar');
  const [scrolled, setScrolled] = useState(false);

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

  /**
   * Dropdown-panel row: icon chip + label + one-line description. Defined as a
   * closure so it can read `t` (marketing.navbar scope). `topLevelLabel` covers
   * the one label ('vendors') that predates the menu.* namespace.
   */
  function MenuRow({
    item,
    topLevelLabel = false,
  }: {
    item: MarketingMenuItem;
    topLevelLabel?: boolean;
  }) {
    const { Icon } = item;
    return (
      <NavigationMenuLink asChild>
        <Link
          href={item.href}
          className="group/row flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-primary">
            <Icon className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground group-hover/row:text-primary">
              {topLevelLabel ? t(item.labelKey) : t(`menu.${item.labelKey}`)}
            </span>
            <span className="block pt-0.5 text-xs text-muted-foreground">
              {t(`menu.${item.descKey}`)}
            </span>
          </span>
        </Link>
      </NavigationMenuLink>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-30 px-3 pt-3 sm:px-4">
      {/*
        Desktop uses a 3-column grid rather than flex + justify-between: the
        logo and the auth-button cluster have different widths, so
        justify-between left the link list optically off-centre. `1fr auto 1fr`
        centres the links against the pill regardless of what flanks them.
        Mobile keeps the plain flex row (logo + drawer trigger only).
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

        {/* Desktop nav — plain links + two dropdown panels */}
        <NavigationMenu className="hidden md:flex md:justify-self-center">
          <NavigationMenuList>
            {PLAIN_LINKS_BEFORE.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild>
                  <Link href={link.href} className={navigationMenuTriggerStyle()}>
                    {t(link.labelKey)}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}

            <NavigationMenuItem>
              <NavigationMenuTrigger>{t('features')}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[26rem] gap-1 p-1" role="list">
                  {FEATURES_MENU.map((item) => (
                    <li key={item.href + item.labelKey}>
                      <MenuRow item={item} />
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>{t('browse')}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[34rem] grid-cols-[1.2fr_1fr] gap-3 p-1">
                  <ul className="grid gap-1" role="list">
                    {BROWSE_MENU.map((item) => (
                      <li key={item.href}>
                        <MenuRow item={item} topLevelLabel={item.labelKey === 'vendors'} />
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-xl bg-background p-3">
                    <p className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wider text-gold-muted">
                      {t('menu.popularSearches')}
                    </p>
                    <ul className="grid gap-0.5" role="list">
                      {POPULAR_SEARCHES.map((link) => (
                        <li key={link.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={link.href}
                              className="block rounded-lg px-2 py-1.5 text-sm text-foreground/75 transition-colors hover:bg-gold/10 hover:text-primary"
                            >
                              {t(`menu.popular.${link.labelKey}`)}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {PLAIN_LINKS_AFTER.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild>
                  <Link href={link.href} className={navigationMenuTriggerStyle()}>
                    {t(link.labelKey)}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

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

        {/* Mobile — slide-in drawer (trigger renders the hamburger) */}
        <MobileNavDrawer />
      </nav>
    </header>
  );
}
