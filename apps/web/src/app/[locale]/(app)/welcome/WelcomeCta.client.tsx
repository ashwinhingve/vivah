'use client';

import { useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
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
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await markWelcomeSeen();
          router.push('/feed');
        })
      }
    >
      Take me to my matches
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
