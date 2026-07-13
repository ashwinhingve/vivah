import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  CreditCard,
  ShieldX,
  Bell,
  Lock,
  Gift,
  Shield,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';

interface SettingsCard {
  href: string;
  icon: typeof CreditCard;
  key: string;
  descriptionKey: string;
}

const SETTINGS_CARDS: readonly SettingsCard[] = [
  {
    href: '/settings/billing',
    icon: CreditCard,
    key: 'billing',
    descriptionKey: 'billingDesc',
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    key: 'notifications',
    descriptionKey: 'notificationsDesc',
  },
  {
    href: '/settings/privacy',
    icon: Shield,
    key: 'privacy',
    descriptionKey: 'privacyDesc',
  },
  {
    href: '/settings/security',
    icon: Lock,
    key: 'security',
    descriptionKey: 'securityDesc',
  },
  {
    href: '/settings/blocks',
    icon: ShieldX,
    key: 'blocks',
    descriptionKey: 'blocksDesc',
  },
  {
    href: '/settings/referral',
    icon: Gift,
    key: 'referral',
    descriptionKey: 'referralDesc',
  },
] as const;

export default async function SettingsPage() {
  const t = await getTranslations('settings');

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        <FadeUp>
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle')}
          />
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SETTINGS_CARDS.map(({ href, icon: Icon, key, descriptionKey }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-gold/20 bg-surface px-4 py-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5 sm:p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h2 className="font-heading text-base font-semibold text-primary group-hover:text-primary/90 transition-colors">
                      {t(key)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {t(descriptionKey)}
                    </p>
                  </div>
                  <div className="mt-1 text-muted-foreground group-hover:text-primary/60 transition-colors">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </FadeUp>
      </main>
    </PageTransition>
  );
}
