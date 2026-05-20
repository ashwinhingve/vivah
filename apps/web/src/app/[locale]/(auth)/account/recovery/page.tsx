import type { Metadata } from 'next';
import RecoveryActions from './RecoveryActions.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Restore your account — Smart Shaadi' };

export default function AccountRecoveryPage() {
  return <RecoveryActions />;
}
