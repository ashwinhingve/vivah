import type { Metadata } from 'next';
import RegisterForm from './RegisterForm.client';

export const metadata: Metadata = { title: 'Create Account — Smart Shaadi' };

export default function RegisterPage() {
  return <RegisterForm />;
}
