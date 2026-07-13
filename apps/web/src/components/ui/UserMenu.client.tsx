'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { User, Settings, CreditCard, LifeBuoy, LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback.client';

type MenuLinkKey = 'viewProfile' | 'settings' | 'subscription' | 'helpSupport';

type MenuLink = {
  href: string;
  key: MenuLinkKey;
  Icon: typeof User;
  external?: boolean;
};

const MENU_LINKS: readonly MenuLink[] = [
  { href: '/dashboard',        key: 'viewProfile',  Icon: User },
  { href: '/settings',         key: 'settings',     Icon: Settings },
  { href: '/settings/billing', key: 'subscription', Icon: CreditCard },
  {
    href: 'mailto:support@smartshaadi.co.in?subject=Help%20with%20Smart%20Shaadi',
    key: 'helpSupport',
    Icon: LifeBuoy,
    external: true,
  },
] as const;

function stripCountryCode(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+91')) return trimmed.slice(3);
  return trimmed.replace(/^\+/, '');
}

export function UserMenu({ photoUrl }: { photoUrl?: string | null }) {
  const t = useTranslations('profile.dropdown');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { data: session } = authClient.useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';
  const phoneNumber = (user as { phoneNumber?: string | null } | undefined)?.phoneNumber ?? null;
  const phoneDigits = stripCountryCode(phoneNumber);
  const contact = phoneDigits ?? user?.email ?? null;
  const isPhoneShaped = (s: string | null | undefined) =>
    !!s && /^\+?\d[\d\s-]{6,}$/.test(s.trim());
  const displayName =
    user?.name && !isPhoneShaped(user.name) ? user.name : null;
  const initials = displayName
    ? displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const roleLabel = t(`roles.${role}` as 'roles.INDIVIDUAL');

  async function handleLogout() {
    setLoading(true);
    try {
      await authClient.signOut();
    } catch {
      // ignore network errors — still redirect
    }
    router.push('/login');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        aria-label={t('userMenu')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {photoUrl ? (
          <ImageWithFallback
            src={photoUrl}
            alt={displayName ?? t('userMenu')}
            name={displayName}
            fill
            sizes="32px"
            wrapperClassName="h-8 w-8 rounded-full"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center select-none">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-gold/20 bg-surface py-1 shadow-lg"
          >
            {(displayName || contact) && (
              <div className="border-b border-gold/15 px-4 py-2">
                {displayName && (
                  <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                )}
                {contact && (
                  <p className="truncate text-xs text-muted-foreground">{contact}</p>
                )}
                <span className="mt-1 inline-block rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-medium text-teal">
                  {roleLabel}
                </span>
              </div>
            )}
            <div className="py-1">
              {MENU_LINKS.map(({ href, key, Icon, external }) => {
                const className =
                  'flex h-10 items-center gap-2.5 px-4 text-sm text-foreground transition-colors hover:bg-gold/10';
                if (external) {
                  return (
                    <a
                      key={href}
                      href={href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={className}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span>{t(key)}</span>
                    </a>
                  );
                }
                return (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={className}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>{t(key)}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-gold/15 py-1">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                role="menuitem"
                className="flex h-10 w-full items-center gap-2.5 px-4 text-left text-sm font-medium text-primary transition-colors hover:bg-gold/10 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{loading ? t('signingOut') : t('signOut')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
