// env.ts loads root .env and validates all required vars on first import
import './lib/env.js';
import { createServer } from 'http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { initSocket } from './chat/socket/index.js';
import { connectMongo } from './lib/mongo.js';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/router.js';
import { securityRouter } from './auth/securityRouter.js';
import { kycRouter, adminKycRouter } from './kyc/router.js';
import { adminStatsRouter } from './admin/stats.router.js';
import { usersRouter } from './users/router.js';
import { profilesRouter } from './profiles/router.js';
import { storageRouter } from './storage/router.js';
import { mockR2Router } from './storage/mockR2.router.js';
import { matchmakingRouter } from './matchmaking/router.js';
import { chatRouter } from './chat/router.js';
import { startGunaRecalcWorker } from './jobs/gunaRecalcJob.js';
import { vendorsRouter } from './vendors/router.js';
import { bookingsRouter } from './bookings/router.js';
import { paymentsRouter } from './payments/router.js';
import { weddingRouter } from './weddings/router.js';
import { guestRouter } from './guests/router.js';
import { videoRouter } from './video/router.js';
import { disputeRouter } from './payments/disputeRouter.js';
import { refundsRouter } from './payments/refundsRouter.js';
import { walletRouter } from './payments/walletRouter.js';
import { promoRouter } from './payments/promoRouter.js';
import { paymentLinksRouter } from './payments/paymentLinksRouter.js';
import { payoutsRouter } from './payments/payoutsRouter.js';
import { analyticsRouter } from './payments/analyticsRouter.js';
import { statementRouter } from './payments/statementRouter.js';
import { invoiceRouter } from './payments/invoiceRouter.js';
import { rentalRouter } from './rentals/router.js';
import { storeRouter } from './store/router.js';
import { escrowAdminRouter } from './admin/escrow.js';
import { webhookHandler } from './payments/webhook.js';
import { storeWebhookHandler } from './store/webhook.js';
import { registerEscrowReleaseWorker } from './jobs/escrowReleaseJob.js';
import { registerOrderExpiryWorker } from './jobs/orderExpiryJob.js';
import { startAccountPurgeWorker } from './jobs/accountPurgeJob.js';
import { devRouter } from './dev/router.js';
import { env } from './lib/env.js';
import { err as errResponse } from './lib/response.js';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────

// Security headers — disable CSP (handled by Next.js) and COEP (not needed for REST API)
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = env.NODE_ENV === 'production'
  ? [
      process.env['CORS_ORIGIN'] ?? env.WEB_URL,
      'https://smartshaadi.co.in',
      'https://www.smartshaadi.co.in',
    ]
  : [
      env.WEB_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  }),
);

app.use(cookieParser());

// Better Auth MUST be mounted before express.json() — it reads the raw body itself.
// authRouter registers GET /me first, then ALL /* for Better Auth's handler.
app.use('/api/auth', authRouter);

// Dev-only R2 stub (USE_MOCK_SERVICES=true). Mounted before express.json so
// raw binary PUTs are handled by the router's own raw parser.
if (env.USE_MOCK_SERVICES) {
  app.use('/__mock-r2', mockR2Router);
}

// Razorpay webhooks — raw body MUST be parsed before global express.json() so
// signature verification sees the exact bytes Razorpay signed.
app.post('/api/v1/payments/webhook', express.raw({ type: '*/*' }), (req, res) => {
  webhookHandler(req, res).catch((error: unknown) => {
    console.error('[payments/webhook] unhandled error:', error);
    if (!res.headersSent) res.status(500).json({ success: false });
  });
});

app.post('/api/v1/store/webhook/razorpay', express.raw({ type: '*/*' }), (req, res) => {
  storeWebhookHandler(req, res).catch((error: unknown) => {
    console.error('[store/webhook/razorpay] unhandled error:', error);
    if (!res.headersSent) res.status(500).json({ success: false });
  });
});

app.use(express.json({ limit: '50kb' }));

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, error: null, meta: { timestamp: new Date().toISOString() } });
});

app.use('/api/v1/auth/kyc', kycRouter);
app.use('/api/v1/kyc', kycRouter);
app.use('/api/v1/admin/kyc', adminKycRouter);
app.use('/api/v1/admin', adminStatsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/me', securityRouter);
app.use('/api/v1/profiles', profilesRouter);
app.use('/api/v1/storage', storageRouter);
app.use('/api/v1/matchmaking', matchmakingRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/vendors', vendorsRouter);
app.use('/api/v1/bookings', bookingsRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/weddings', weddingRouter);
app.use('/api/v1', guestRouter);
app.use('/api/v1/video', videoRouter);
app.use('/api/v1/payments', disputeRouter);
app.use('/api/v1/payments/refunds', refundsRouter);
app.use('/api/v1/payments/wallet', walletRouter);
app.use('/api/v1/payments/promos', promoRouter);
app.use('/api/v1/payments/links', paymentLinksRouter);
app.use('/api/v1/payments/payouts', payoutsRouter);
app.use('/api/v1/payments/admin/analytics', analyticsRouter);
app.use('/api/v1/payments/statement', statementRouter);
app.use('/api/v1/payments/invoices', invoiceRouter);
app.use('/api/v1/rentals', rentalRouter);
app.use('/api/v1/store', storeRouter);
app.use('/api/v1/admin', escrowAdminRouter);

// Dev-only routes — mount synchronously BEFORE the 404/error handlers so errors
// thrown by dev handlers reach the global error middleware.
if (env.NODE_ENV === 'development') {
  app.use('/api/v1/dev', devRouter);
}

// ── 404 catch-all ─────────────────────────────────────────────────────────────
// Unknown paths must return the standard envelope, not Express's raw HTML.
app.use((req: Request, res: Response): void => {
  errResponse(res, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`, 404);
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches sync throws and any error forwarded via next(err). Handles common
// parse errors (Zod, Postgres uuid, Mongoose cast, JSON body).
app.use((error: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) { next(error); return; }

  // Zod validation errors thrown via .parse()
  if (error instanceof ZodError) {
    errResponse(res, 'VALIDATION_ERROR', error.issues[0]?.message ?? 'Invalid input', 400, {
      issues: error.issues as unknown as Record<string, unknown>[],
    });
    return;
  }

  // Postgres: invalid UUID / malformed input (22P02)
  const code = (error as { code?: string } | undefined)?.code;
  if (code === '22P02') {
    errResponse(res, 'INVALID_ID', 'Malformed id in request', 400);
    return;
  }

  // express.json() body parse failure
  if ((error as { type?: string }).type === 'entity.parse.failed') {
    errResponse(res, 'INVALID_JSON', 'Request body is not valid JSON', 400);
    return;
  }

  // Mongoose CastError (invalid ObjectId or similar)
  if ((error as { name?: string }).name === 'CastError') {
    errResponse(res, 'INVALID_ID', 'Malformed id in request', 400);
    return;
  }

  console.error('[api] unhandled error', error);
  errResponse(res, 'INTERNAL_ERROR', 'Internal server error', 500);
});

process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[api] uncaughtException', err);
});

// ── Start ──────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  if (env.NODE_ENV === 'development') {
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

  // Workers — skip in mock/test mode to avoid connecting to Redis that isn't
  // configured, and to keep CI / vitest from holding live connections.
  if (!env.USE_MOCK_SERVICES) {
    void startGunaRecalcWorker();
    registerEscrowReleaseWorker();
    registerOrderExpiryWorker();
    startAccountPurgeWorker();
  }

  // Graceful shutdown — Railway sends SIGTERM before killing containers.
  const shutdown = (signal: string): void => {
    console.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      console.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void bootstrap();
