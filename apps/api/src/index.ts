// env.ts loads root .env and validates all required vars on first import
import './lib/env.js';
import { createServer } from 'http';
import express, { type Request, type Response } from 'express';
import { initSocket } from './chat/socket/index.js';
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
import { chatRouter } from './chat/router.js';
import { startGunaRecalcWorker } from './jobs/gunaRecalcJob.js';
import { vendorsRouter } from './vendors/router.js';
import { bookingsRouter } from './bookings/router.js';
import { paymentsRouter } from './payments/router.js';
import { webhookHandler } from './payments/webhook.js';
import { registerEscrowReleaseWorker } from './jobs/escrowReleaseJob.js';
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

// Razorpay webhook — raw body MUST be parsed before global express.json()
app.post('/api/v1/payments/webhook', express.raw({ type: '*/*' }), (req, res) => {
  webhookHandler(req, res).catch((error: unknown) => {
    console.error('[payments/webhook] unhandled error:', error);
    if (!res.headersSent) res.status(500).json({ success: false });
  });
});

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
app.use('/api/v1/chat', chatRouter);              // GET /conversations, GET /conversations/:id, POST photos
app.use('/api/v1/vendors', vendorsRouter);        // GET /vendors, GET /vendors/:id, POST /vendors
app.use('/api/v1/bookings', bookingsRouter);      // POST /bookings, GET /bookings/:id, PATCH status
app.use('/api/v1/payments', paymentsRouter);      // POST /payments/order, GET /payments/:id

// ── Start ──────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  if (env.NODE_ENV === 'development') {
    const { devRouter } = await import('./dev/router.js');
    app.use('/api/v1/dev', devRouter);
    console.info('🔧 Dev router mounted at /api/v1/dev');
  }

  connectMongo().catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    if (!env.USE_MOCK_SERVICES) { process.exit(1); }
  });

  const server = createServer(app);
  initSocket(server);
  server.listen(env.PORT, () => {
    console.info(`API server running on port ${env.PORT}`);
  });

  if (!env.USE_MOCK_SERVICES) { void startGunaRecalcWorker(); }

  // Start escrow release worker — processes 48h delayed payouts
  registerEscrowReleaseWorker();
}

void bootstrap();
