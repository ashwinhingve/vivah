import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyForm from './VerifyForm.client';

export const metadata: Metadata = { title: 'Verify OTP — Smart Shaadi' };

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
