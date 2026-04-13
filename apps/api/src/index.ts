// env.ts loads root .env and validates all required vars on first import
import './lib/env.js';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/router.js';
import { kycRouter, adminKycRouter } from './kyc/router.js';
import { usersRouter } from './users/router.js';
import { env } from './lib/env.js';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: env.WEB_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.use(cookieParser());

// Better Auth MUST be mounted before express.json() — it reads the raw body itself.
// authRouter registers GET /me first, then ALL /* for Better Auth's handler.
app.use('/api/auth', authRouter);

app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, error: null, meta: { timestamp: new Date().toISOString() } });
});

app.use('/api/v1/auth/kyc', kycRouter);      // POST /api/v1/auth/kyc/initiate (spec alias)
app.use('/api/v1/kyc', kycRouter);            // GET /api/v1/kyc/status, POST /api/v1/kyc/photo
app.use('/api/v1/admin/kyc', adminKycRouter); // Admin review queue
app.use('/api/v1/users', usersRouter);        // PATCH /api/v1/users/me/role

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(env.PORT, () => {
  console.info(`API server running on port ${env.PORT}`);
});
