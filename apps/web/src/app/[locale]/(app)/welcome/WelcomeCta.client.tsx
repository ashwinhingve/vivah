'use client';

import { useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { markWelcomeSeen } from './actions';

/**
 * Welcome-gate CTA. Awaits the cookie-setting Server Action, then navigates
 * client-side — sequencing that avoids the middleware race a server-side
 * redirect had (see actions.ts).
 */
export function WelcomeCta() {
  const router = useRouter();
  const t = useTranslations('welcome');
  const [pending, startTransition] = useTransition();
  const ctaText = t('cta');

  return (
    <Button
      size="lg"
      loading={pending}
      aria-label={ctaText}
      onClick={() =>
        startTransition(async () => {
          await markWelcomeSeen();
          router.push('/feed');
        })
      }
    >
      {ctaText}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
