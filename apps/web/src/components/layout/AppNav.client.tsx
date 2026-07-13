'use client';

import { useState, useEffect, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MoreHorizontal, X } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { navForRole, filterForDemo, activeNavHref, type NavGroup } from './nav-config';

export function AppNav() {
  const t = useTranslations('nav.app');
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const reduce = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Sheet keyboard handling: Escape closes; Tab is trapped inside the dialog.
  // On close, focus returns to the "More" trigger.
  useEffect(() => {
    if (!moreOpen) return;
    const trigger = moreButtonRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusables = Array.from(
        sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === first || !sheet.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !sheet.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [moreOpen]);

  const { primary: primaryRaw, moreGroups: moreGroupsRaw } = navForRole(role);
  const moreGroups: NavGroup[] = moreGroupsRaw
    .map((g) => ({ ...g, items: filterForDemo(g.items) }))
    .filter((g) => g.items.length > 0);
  const moreItems = moreGroups.flatMap((g) => g.items);
  const showMore = moreItems.length > 0;

  const primary = filterForDemo(primaryRaw);
  // Most specific matching href across the whole nav set wins, so nested
  // routes (`/payments/wallet`) light one item, not two.
  const currentHref = activeNavHref(
    pathname,
    [...primary, ...moreItems].map((i) => i.href),
  );
  const moreActive = showMore && moreItems.some((i) => i.href === currentHref);

  return (
    <>
      <nav
        aria-label={t('primaryNav')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/25 bg-surface/85 shadow-[0_-4px_20px_-8px_rgba(123,45,66,0.08)] backdrop-blur-xl md:hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
        />
        <div className="mx-auto flex max-w-lg items-stretch">
          {primary.map(({ href, labelKey, Icon }) => {
            const active = href === currentHref;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal',
                  active ? 'text-teal' : 'text-muted-foreground hover:text-primary'
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="app-nav-pill"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 500, damping: 32 }
                    }
                    className="absolute inset-x-2 top-1 bottom-1 -z-10 rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform',
                    active ? 'scale-110' : 'scale-100 group-hover:scale-105'
                  )}
                  strokeWidth={active ? 2.5 : 1.75}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-2xs leading-none',
                    active ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {t(labelKey)}
                </span>
              </Link>
            );
          })}
          {showMore ? (
            <button
              type="button"
              ref={moreButtonRef}
              onClick={() => setMoreOpen(v => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label={t('moreLabel')}
              className={cn(
                'group relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal',
                moreActive || moreOpen ? 'text-teal' : 'text-muted-foreground hover:text-primary'
              )}
            >
              {moreActive && !moreOpen ? (
                <motion.span
                  layoutId="app-nav-pill"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 500, damping: 32 }
                  }
                  className="absolute inset-x-2 top-1 bottom-1 -z-10 rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20"
                  aria-hidden="true"
                />
              ) : null}
              {moreOpen ? (
                <X
                  className="h-5 w-5 scale-110 transition-transform"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              ) : (
                <MoreHorizontal
                  className={cn(
                    'h-5 w-5 transition-transform',
                    'scale-100 group-hover:scale-105'
                  )}
                  strokeWidth={moreActive ? 2.5 : 1.75}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  'text-2xs leading-none',
                  moreActive || moreOpen ? 'font-semibold' : 'font-medium'
                )}
              >
                {t('more')}
              </span>
            </button>
          ) : null}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {showMore ? (
        <AnimatePresence>
          {moreOpen ? (
            <>
              <motion.div
                key="more-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
                onClick={() => setMoreOpen(false)}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                aria-hidden="true"
              />
              <motion.div
                key="more-sheet"
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-label={t('moreNavigation')}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 360, damping: 34 }
                }
                className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-gold/25 bg-surface shadow-2xl md:hidden"
              >
                <div className="mx-auto max-w-lg">
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMoreOpen(false)}
                      aria-label={t('closeMenu')}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-gold/10 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="px-5 pb-2">
                    <p className="text-2xs font-semibold uppercase tracking-widest text-gold-muted" aria-hidden="true">
                      {t('more')}
                    </p>
                    <h2 className="font-heading text-lg font-semibold text-primary">
                      {t('everythingElse')}
                    </h2>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                    {moreGroups.map((group) => (
                      <section key={group.titleKey} className="mt-2 first:mt-0">
                        <h3 className="px-3 pt-3 pb-1 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {t(group.titleKey)}
                        </h3>
                        <ul>
                          {group.items.map(({ href, labelKey, Icon }) => {
                            const active = href === currentHref;
                            return (
                              <li key={href}>
                                <Link
                                  href={href}
                                  aria-current={active ? 'page' : undefined}
                                  className={cn(
                                    'flex min-h-[56px] items-center gap-3 rounded-xl px-3 py-3 transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal',
                                    active
                                      ? 'bg-teal/10 text-teal'
                                      : 'text-foreground hover:bg-gold/10'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'flex h-10 w-10 items-center justify-center rounded-lg',
                                      active ? 'bg-teal/15 text-teal' : 'bg-gold/10 text-primary'
                                    )}
                                    aria-hidden="true"
                                  >
                                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                                  </span>
                                  <span className="text-sm font-medium">{t(labelKey)}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      ) : null}
    </>
  );
}
