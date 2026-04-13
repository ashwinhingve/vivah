import { Router, type Request, type Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './config.js';
import { authenticate } from './middleware.js';
import { ok } from '../lib/response.js';

export const authRouter = Router();

/**
 * GET /api/auth/me — returns the current authenticated user's id, role, and status.
 *
 * IMPORTANT: Must be registered BEFORE the Better Auth wildcard below, so Express
 * matches /me here and never forwards it to Better Auth's handler.
 */
authRouter.get('/me', authenticate, (req: Request, res: Response) => {
  ok(res, {
    userId: req.user!.id,
    role:   req.user!.role,
    status: req.user!.status,
  });
});

/**
 * ALL /api/auth/* — Better Auth handles all its built-in routes:
 *   POST /phone-number/send-otp
 *   POST /phone-number/verify-otp
 *   POST /sign-in/email  |  POST /sign-up/email
 *   POST /sign-out
 *   GET  /get-session
 *   ... and all other Better Auth endpoints
 *
 * Better Auth MUST be mounted before express.json() in index.ts so it can
 * read the raw request body itself.
 */
authRouter.all('/*', toNodeHandler(auth));
