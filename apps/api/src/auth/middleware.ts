import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './config.js';
import type { UserRole } from '@smartshaadi/types';
import { AuthErrorCode } from '@smartshaadi/types';
import { err } from '../lib/response.js';

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

  req.user = {
    id:          session.user.id,
    role:        (session.user as { role?: string }).role ?? 'INDIVIDUAL',
    status:      (session.user as { status?: string }).status ?? 'PENDING_VERIFICATION',
    phoneNumber: (session.user as { phoneNumber?: string | null }).phoneNumber ?? null,
    name:        session.user.name,
    email:       session.user.email,
  };

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
