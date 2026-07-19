'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

/**
 * Mark divorcee onboarding as complete. Calls
 * PUT /api/v1/profiles/me/sections/divorcee-onboarding to set
 * profileSections.divorceeOnboardingDone = true.
 */
export function MarkDivorceeOnboardingDone() {
  const t = useTranslations('divorceeOnboarding');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/profiles/me/sections/divorcee-onboarding`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: true }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          toast(t('completionError'), 'error');
          return;
        }

        toast(t('completionSuccess'), 'success');
        router.refresh();
      } catch (e) {
        console.error('[divorcee] completion failed', e);
        toast(t('completionError'), 'error');
      }
    });
  };

  return (
    <Button
      className="w-full"
      onClick={handleComplete}
      disabled={isPending}
    >
      {isPending ? t('marking') : t('buttonReady')}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
