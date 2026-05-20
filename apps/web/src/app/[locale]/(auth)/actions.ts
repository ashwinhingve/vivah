'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserRole } from '@smartshaadi/types';
import { readSessionCookie } from '@/lib/auth/session-cookie';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

/**
 * Sends an OTP to the given phone number via Better Auth.
 * On success, redirects to /verify-otp?phone=... so the user can enter the code.
 * Phone must be E.164 format: +91XXXXXXXXXX
 */
export async function requestOTP(
  phone: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_URL}/api/auth/phone-number/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { success: false, error: body.message ?? 'Failed to send OTP' };
  }

  redirect(`/verify-otp?phone=${encodeURIComponent(phone)}`);
}

/**
 * Sets the user's role after registration.
 * Reads the Better Auth session cookie and calls PATCH /api/v1/users/me/role.
 */
export async function setRoleAction(
  role: UserRole,
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies();
  const sessionCookie = readSessionCookie(cookieStore);

  if (!sessionCookie) {
    return { success: false, error: 'Not authenticated' };
  }

  const res = await fetch(`${API_URL}/api/v1/users/me/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${sessionCookie.name}=${sessionCookie.value}`,
    },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { success: false, error: body.error ?? 'Failed to set role' };
  }

  return { success: true };
}
