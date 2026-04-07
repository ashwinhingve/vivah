import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from './jwt.js';
import type { UserRole, JwtPayload } from '@vivah/types';
import { AuthErrorCode } from '@vivah/types';
import { err } from '../lib/response.js';

// Augment Express Request so TypeScript knows about req.user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Validates Bearer token and attaches req.user. Returns 401 on failure. */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers['authorization'];

  if (!header?.startsWith('Bearer ')) {
    err(res, AuthErrorCode.UNAUTHORIZED, 'Missing or malformed Authorization header', 401);
    return;
  }

  const token = header.slice(7);

  try {
    req.user = await verifyAccess(token);
    next();
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'TOKEN_EXPIRED') {
      err(res, AuthErrorCode.TOKEN_EXPIRED, 'Access token has expired', 401);
    } else {
      err(res, AuthErrorCode.TOKEN_INVALID, 'Invalid access token', 401);
    }
  }
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
    if (!roles.includes(req.user.role)) {
      err(res, AuthErrorCode.FORBIDDEN, 'Insufficient permissions', 403);
      return;
    }
    next();
  };
}
