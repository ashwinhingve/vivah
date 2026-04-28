/**
 * Smart Shaadi — auth audit log
 * apps/api/src/auth/events.ts
 *
 * Append-only event sink for /me/security/events. Writes to `auth_events`.
 * Used by Better Auth lifecycle hooks (sign-in, sign-up, sign-out, delete)
 * and by the security router (manual session revoke, phone change, MFA).
 *
 * `recordAuthEvent` is fire-and-forget — never blocks the auth path.
 */

import { randomUUID } from 'crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { authEvents } from '@smartshaadi/db';

export const AuthEventType = {
  LOGIN_SUCCESS:               'LOGIN_SUCCESS',
  LOGIN_FAILED:                'LOGIN_FAILED',
  OTP_SENT:                    'OTP_SENT',
  OTP_VERIFIED:                'OTP_VERIFIED',
  OTP_FAILED:                  'OTP_FAILED',
  OTP_LOCKED:                  'OTP_LOCKED',
  LOGOUT:                      'LOGOUT',
  SESSION_REVOKED:             'SESSION_REVOKED',
  ROLE_CHANGED:                'ROLE_CHANGED',
  PHONE_CHANGED:               'PHONE_CHANGED',
  EMAIL_CHANGED:               'EMAIL_CHANGED',
  MFA_ENABLED:                 'MFA_ENABLED',
  MFA_DISABLED:                'MFA_DISABLED',
  MFA_VERIFIED:                'MFA_VERIFIED',
  MFA_FAILED:                  'MFA_FAILED',
  MFA_BACKUP_USED:             'MFA_BACKUP_USED',
  ACCOUNT_DELETION_REQUESTED:  'ACCOUNT_DELETION_REQUESTED',
  ACCOUNT_DELETED:             'ACCOUNT_DELETED',
  ACCOUNT_RESTORED:            'ACCOUNT_RESTORED',
  ACCOUNT_REGISTERED:          'ACCOUNT_REGISTERED',
  NEW_DEVICE_LOGIN:            'NEW_DEVICE_LOGIN',
  PASSWORD_CHANGED:            'PASSWORD_CHANGED',
} as const;

export type AuthEventType = (typeof AuthEventType)[keyof typeof AuthEventType];

export interface RecordEventInput {
  userId: string | null;
  type: AuthEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget audit write. Never throws — errors are logged and swallowed
 * so an audit-log failure cannot break the user-facing auth flow.
 */
export function recordAuthEvent(input: RecordEventInput): void {
  const row = {
    id:        randomUUID(),
    userId:    input.userId ?? null,
    type:      input.type,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    metadata:  input.metadata ?? null,
    createdAt: new Date(),
  };
  void Promise.resolve()
    .then(() => db.insert(authEvents).values(row))
    .catch((error: unknown) => {
      console.warn('[auth-events] insert failed', { type: input.type, error });
    });
}

/**
 * Returns true when the (userId, ipAddress, userAgent) tuple has not appeared
 * in a LOGIN_SUCCESS event in the last 90 days. Used by the sign-in hook to
 * flag suspicious sign-ins. Best-effort — DB errors fall through as `false`
 * (do not flag) to avoid spurious alerts.
 */
export async function isNewDevice(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<boolean> {
  if (!ipAddress && !userAgent) return false;
  try {
    const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ id: authEvents.id })
      .from(authEvents)
      .where(
        and(
          eq(authEvents.userId, userId),
          eq(authEvents.type, AuthEventType.LOGIN_SUCCESS),
          gte(authEvents.createdAt, ninetyDays),
          ipAddress ? eq(authEvents.ipAddress, ipAddress) : sql`TRUE`,
          userAgent ? eq(authEvents.userAgent, userAgent) : sql`TRUE`,
        ),
      )
      .limit(1);
    return rows.length === 0;
  } catch (error) {
    console.warn('[auth-events] isNewDevice query failed', error);
    return false;
  }
}

/**
 * Read most recent events for a user. Bounded LIMIT keeps payload predictable.
 */
export async function listRecentEvents(
  userId: string,
  limit = 50,
): Promise<Array<{
  id: string;
  type: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}>> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const rows = await db
    .select({
      id:        authEvents.id,
      type:      authEvents.type,
      ipAddress: authEvents.ipAddress,
      userAgent: authEvents.userAgent,
      metadata:  authEvents.metadata,
      createdAt: authEvents.createdAt,
    })
    .from(authEvents)
    .where(eq(authEvents.userId, userId))
    .orderBy(desc(authEvents.createdAt))
    .limit(safeLimit);
  return rows;
}
