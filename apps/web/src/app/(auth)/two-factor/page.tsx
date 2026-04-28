import type { Metadata } from 'next';
import { Suspense } from 'react';
import TwoFactorChallengeForm from './TwoFactorChallengeForm.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Two-Factor Verification — Smart Shaadi' };

export default function TwoFactorChallengePage() {
  return (
    <Suspense>
      <TwoFactorChallengeForm />
    </Suspense>
  );
}
