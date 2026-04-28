import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './config.js';
import type { UserRole } from '@smartshaadi/types';
import { AuthErrorCode } from '@smartshaadi/types';
import { err } from '../lib/response.js';
import { pingLastActive } from './lastActive.js';

// Augment Express Request with Better Auth session data
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        status: string;
        phoneNumber?: string | null;
        name: string;
        email?: string | null;
      };
    }
  }
}

/** Validates Better Auth session cookie and attaches req.user. Returns 401 on failure. */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    err(res, AuthErrorCode.UNAUTHORIZED, 'Not authenticated', 401);
    return;
  }

  // Soft-deleted users hold a stale session cookie until their cookie cache
  // expires (5 min). Block them at the gate so /api/v1/* never serves data
  // back to a pending-deletion account. Only the /me/account/restore endpoint
  // is allowed through (handled inside the security router using a separate
  // path that bypasses this guard).
  const deletionRequestedAt = (session.user as { deletionRequestedAt?: Date | string | null })
    .deletionRequestedAt;
  // Bypass list: paths the user MUST be able to reach while their account is
  // in the 30-day grace window so they can either restore it or read why
  // they're locked out.
  const isAllowedDuringDeletion =
    req.path.startsWith('/account/restore') ||
    req.path.startsWith('/account/delete') ||
    req.path.startsWith('/security/overview') ||
    req.path.startsWith('/security/events') ||
    req.path === '/sessions';
  if (deletionRequestedAt && !isAllowedDuringDeletion) {
    err(res, 'ACCOUNT_PENDING_DELETION', 'Account is pending deletion', 403, {
      deletionRequestedAt: typeof deletionRequestedAt === 'string'
        ? deletionRequestedAt
        : deletionRequestedAt.toISOString(),
    });
    return;
  }

  req.user = {
    id:          session.user.id,
    role:        (session.user as { role?: string }).role ?? 'INDIVIDUAL',
    status:      (session.user as { status?: string }).status ?? 'PENDING_VERIFICATION',
    phoneNumber: (session.user as { phoneNumber?: string | null }).phoneNumber ?? null,
    name:        session.user.name,
    email:       session.user.email,
  };

  pingLastActive(req.user.id);
  next();
}

/**
 * Restrict access to specific roles. Must be used after authenticate().
 * Usage: router.get('/admin', authenticate, authorize(['ADMIN', 'SUPPORT']), handler)
 */
export function authorize(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      err(res, AuthErrorCode.UNAUTHORIZED, 'Not authenticated', 401);
      return;
    }
    if (!roles.includes(req.user.role as UserRole)) {
      err(res, AuthErrorCode.FORBIDDEN, 'Insufficient permissions', 403);
      return;
    }
    next();
  };
}
