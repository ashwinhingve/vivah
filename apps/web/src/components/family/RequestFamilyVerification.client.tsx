'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { requestFamilyVerificationAction } from '@/app/(app)/family/actions';

interface Props { verified: boolean; }

export function RequestFamilyVerification({ verified }: Props) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  if (verified) return null;

  function handleClick(): void {
    start(async () => {
      const r = await requestFamilyVerificationAction();
      if (r.ok) toast('Verification request sent', 'success');
      else toast(r.error ?? 'Failed', 'error');
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-[#0E7C7B] underline mt-1 disabled:opacity-60 inline-flex items-center gap-1"
    >
      {pending && <Loader2 className="h-3 w-3 animate-spin" />} Request verification
    </button>
  );
}
