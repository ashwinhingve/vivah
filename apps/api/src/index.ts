// env.ts loads root .env and validates all required vars on first import
import './lib/env.js';
import express, { type Request, type Response } from 'express';
import { connectMongo } from './lib/mongo.js';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/router.js';
import { kycRouter, adminKycRouter } from './kyc/router.js';
import { usersRouter } from './users/router.js';
import { profilesRouter } from './profiles/router.js';
import { storageRouter } from './storage/router.js';
import { matchmakingRouter } from './matchmaking/router.js';
import { env } from './lib/env.js';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────

// Security headers — disable CSP (handled by Next.js) and COEP (not needed for REST API)
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(
  cors({
    origin: env.WEB_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(cookieParser());

// Better Auth MUST be mounted before express.json() — it reads the raw body itself.
// authRouter registers GET /me first, then ALL /* for Better Auth's handler.
app.use('/api/auth', authRouter);

app.use(express.json({ limit: '50kb' }));

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, error: null, meta: { timestamp: new Date().toISOString() } });
});

app.use('/api/v1/auth/kyc', kycRouter);      // POST /api/v1/auth/kyc/initiate (spec alias)
app.use('/api/v1/kyc', kycRouter);            // GET /api/v1/kyc/status, POST /api/v1/kyc/photo
app.use('/api/v1/admin/kyc', adminKycRouter); // Admin review queue
app.use('/api/v1/users', usersRouter);        // PATCH /api/v1/users/me/role
app.use('/api/v1/profiles', profilesRouter); // GET|PUT /me, GET /:id
app.use('/api/v1/storage', storageRouter);   // POST /presign
app.use('/api/v1/matchmaking', matchmakingRouter); // GET /feed, GET /score/:id, POST|PUT /requests

// ── Start ──────────────────────────────────────────────────────────────────────

connectMongo().catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  // Non-fatal in mock mode; fatal in production (process exits)
  if (!process.env['USE_MOCK_SERVICES'] || process.env['USE_MOCK_SERVICES'] !== 'true') {
    process.exit(1);
  }
});

app.listen(env.PORT, () => {
  console.info(`API server running on port ${env.PORT}`);
});
