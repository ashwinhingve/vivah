import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyOtpForm from './VerifyOtpForm.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Verify OTP — Smart Shaadi' };

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}
