import type { Metadata } from 'next';
import LoginForm from './LoginForm.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign In — Smart Shaadi' };

export default function LoginPage() {
  return <LoginForm />;
}
