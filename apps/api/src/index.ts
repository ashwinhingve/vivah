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
import { mediaRouter } from './storage/media.router.js';
import { matchmakingRouter } from './matchmaking/router.js';
import { chatRouter } from './chat/router.js';
import { startGunaRecalcWorker } from './jobs/gunaRecalcJob.js';
import { startNotificationsWorker } from './jobs/notificationsWorker.js';
import { vendorsRouter } from './vendors/router.js';
import { bookingsRouter } from './bookings/router.js';
import { paymentsRouter } from './payments/router.js';
import { weddingRouter } from './weddings/router.js';
import { weddingExtrasRouter, publicRsvpRouter } from './weddings/extras.router.js';
import { invitesPublicRouter } from './weddings/invite.router.js';
import { coordinatorRouter, weddingCoordinatorRouter } from './weddings/coordinator.router.js';
import { weddingIncidentsRouter } from './weddings/incidents.router.js';
import { weddingDayOfRouter } from './weddings/dayOf.router.js';
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
import { subscriptionsRouter } from './payments/subscriptionsRouter.js';
import { paymentSplitsRouter } from './payments/paymentSplitsRouter.js';
import { csvExportRouter } from './payments/csvExportRouter.js';
import { adminVendorsRouter } from './admin/vendors.router.js';
import { reconciliationRouter } from './payments/reconciliationRouter.js';
import { rentalRouter } from './rentals/router.js';
import { storeRouter } from './store/router.js';
import { calendarRouter } from './calendar/router.js';
import { escrowAdminRouter } from './admin/escrow.js';
import { stayQuotientAdminRouter } from './admin/stayQuotient.router.js';
import { reputationAdminRouter } from './admin/reputation.router.js';
import { adminAnalyticsRouter } from './admin/analytics.router.js';
import { platformSettingsRouter, platformSettingsPublicRouter } from './admin/platformSettings.router.js';
import { webhookHandler } from './payments/webhook.js';
import { storeWebhookHandler } from './store/webhook.js';
import { registerEscrowReleaseWorker } from './jobs/escrowReleaseJob.js';
import { registerInvitationBlastWorker } from './jobs/invitationBlastJob.js';
import { registerEmbeddingWorker } from './jobs/embeddingGenerationJob.js';
import {
  registerAuditChainVerifierWorker,
  scheduleAuditChainVerifierJob,
} from './jobs/auditChainVerifierJob.js';
import {
  registerEmotionalScoreWorker,
  scheduleEmotionalScoreJob,
} from './jobs/emotionalScoreJob.js';
import {
  registerExpireGracePeriodsWorker,
  scheduleExpireGracePeriodsJob,
} from './jobs/expireGracePeriodsJob.js';
import {
  registerHistoricalAttendanceWorker,
  scheduleHistoricalAttendanceJob,
} from './jobs/historicalAttendanceJob.js';
import { metricsMiddleware, metricsHandler } from './lib/metrics.js';
import { registerOrderExpiryWorker } from './jobs/orderExpiryJob.js';
import { startAccountPurgeWorker } from './jobs/accountPurgeJob.js';
import {
  registerMatchRequestExpiryWorker,
  scheduleMatchRequestExpiryJob,
} from './jobs/matchRequestExpiryJob.js';
import {
  registerWeddingReminderWorker,
  scheduleWeddingReminderJob,
} from './jobs/weddingReminderJob.js';
import { registerWeddingCompletionWorker } from './jobs/weddingCompletionJob.js';
import { registerRsvpReminderWorker } from './jobs/rsvpReminderJob.js';
import { registerSaveTheDateWorker } from './jobs/saveTheDateJob.js';
import { registerThankYouWorker } from './jobs/thankYouJob.js';
import {
  registerTokenCleanupWorker,
  scheduleTokenCleanupJob,
} from './jobs/tokenCleanupJob.js';
import { devRouter } from './dev/router.js';
import { internalRouter } from './routes/internal.js';
import { aiRouter } from './routes/ai.js';
import { registerP3Routes, registerP3Workers } from './routes/_p3Register.js';
import { env } from './lib/env.js';
import { err as errResponse } from './lib/response.js';
import { logger } from './lib/logger.js';
import { requestIdMiddleware } from './lib/requestId.js';
import { initSentry, setupSentryErrorHandler, captureException } from './lib/sentry.js';
import { applyGlobalRateLimit, authLimiter } from './lib/rateLimit.js';
import { corsOriginDelegate } from './lib/cors.js';
import { behaviorCaptureMiddleware } from './behavior/middleware.js';
import { registerBehaviorEventWorker } from './behavior/worker.js';
import {
  registerBehaviorAggregateWorker,
  scheduleBehaviorAggregateJob,
} from './jobs/behaviorAggregateJob.js';

initSentry();

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(requestIdMiddleware);

// Security headers — disable CSP (handled by Next.js) and COEP (not needed for REST API)
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS allowlist — exact prod/dev origins + Vercel preview URLs for our project,
// via the shared delegate in lib/cors.ts (also used by the chat socket server so
// the two never drift). credentials:true is required for the session cookie;
// the delegate never returns a wildcard, which browsers reject with credentials.
app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  }),
);

app.use(cookieParser());

applyGlobalRateLimit(app);

// Better Auth MUST be mounted before express.json() — it reads the raw body itself.
// authRouter registers GET /me first, then ALL /* for Better Auth's handler.
// authLimiter adds an explicit Express-layer 429 gate in front of Better Auth's
// own limiter + the Redis otpLockout (defense-in-depth on login/OTP/refresh).
app.use('/api/auth', authLimiter, authRouter);

// Dev-only R2 stub (USE_MOCK_SERVICES=true). Mounted before express.json so
// raw binary PUTs are handled by the router's own raw parser. Module is
// statically imported but has no side effects, so a prod bundle that never
// hits this branch carries an inert router with zero handler attachment.
if (env.USE_MOCK_SERVICES) {
  app.use(
    '/__mock-r2',
    (_req, res, next) => {
      // Same cross-origin <img>/<audio> exposure as /__media below — helmet
      // defaults CORP to same-origin, which blocks the web↔api origin split.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    mockR2Router,
  );
}

// Always-on media redirect: resolves a bare R2 key to a fresh presigned/mock
// URL (302). The production counterpart to /__mock-r2 — the web client turns
// every bare key into `${API_ORIGIN}/__media/${key}`. Unauthenticated by design,
// scoped to display-media prefixes only (see storage/media.router.ts).
app.use('/__media', mediaRouter);

// Razorpay webhooks — raw body MUST be parsed before global express.json() so
// signature verification sees the exact bytes Razorpay signed.
app.post('/api/v1/payments/webhook', express.raw({ type: '*/*' }), (req, res) => {
  webhookHandler(req, res).catch((error: unknown) => {
    console.error('[payments/webhook] unhandled error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        data: null,
        error: { code: 'INTERNAL', message: 'Webhook processing error' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  });
});

app.post('/api/v1/store/webhook/razorpay', express.raw({ type: '*/*' }), (req, res) => {
  storeWebhookHandler(req, res).catch((error: unknown) => {
    console.error('[store/webhook/razorpay] unhandled error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        data: null,
        error: { code: 'INTERNAL', message: 'Webhook processing error' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  });
});

app.use(express.json({ limit: '50kb' }));

// ── Routes ─────────────────────────────────────────────────────────────────────

app.use(metricsMiddleware);
app.use(behaviorCaptureMiddleware);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, error: null, meta: { timestamp: new Date().toISOString() } });
});

// /metrics — Prometheus exposition. Internal observability surface; gated by
// METRICS_TOKEN bearer when set so we don't expose queue depths and request
// counts to the world. Mock/dev mode without a token leaves it open.
app.get('/metrics', (req: Request, res: Response, next: NextFunction): void => {
  const token = env.METRICS_TOKEN;
  if (!token) { void metricsHandler(req, res).catch(next); return; }
  const header = req.header('authorization') ?? '';
  if (header !== `Bearer ${token}`) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'metrics endpoint requires bearer token' },
      meta: { timestamp: new Date().toISOString() },
    });
    return;
  }
  void metricsHandler(req, res).catch(next);
});

// /ready — deeper liveness probe. Checks DB + Redis reachability.
// /health = process alive. /ready = dependencies reachable.
// Railway / load balancers use /ready for traffic routing decisions.
app.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | string> = {};
  let allOk = true;

  if (env.USE_MOCK_SERVICES) checks['mode'] = 'mock';

  // Postgres + Redis are local infra — required even in mock mode (mock only
  // skips external SaaS like Razorpay/MSG91). If they are down the API cannot
  // serve traffic, so /ready must reflect that.
  try {
    const { db } = await import('./lib/db.js');
    await (db.$client as unknown as { query: (q: string) => Promise<unknown> }).query('SELECT 1');
    checks['postgres'] = 'ok';
  } catch (err) {
    checks['postgres'] = err instanceof Error ? err.message : 'unreachable';
    allOk = false;
  }

  try {
    const { redis } = await import('./lib/redis.js');
    await redis.ping();
    checks['redis'] = 'ok';
  } catch (err) {
    checks['redis'] = err instanceof Error ? err.message : 'unreachable';
    allOk = false;
  }

  // Mongo is gated — connectMongo() is a no-op in mock mode, so a ping would
  // return false-negatives. Only check when real connection is expected.
  if (!env.USE_MOCK_SERVICES) {
    try {
      const { mongoose } = await import('./lib/mongo.js');
      // 1 = connected, 2 = connecting, others = unhealthy.
      const state = mongoose.connection.readyState;
      if (state === 1) {
        checks['mongo'] = 'ok';
      } else {
        checks['mongo'] = `readyState=${state}`;
        allOk = false;
      }
    } catch (err) {
      checks['mongo'] = err instanceof Error ? err.message : 'unreachable';
      allOk = false;
    }
  }

  res.status(allOk ? 200 : 503).json({
    success: allOk,
    data: { status: allOk ? 'ready' : 'not_ready', checks },
    error: null,
    meta: { timestamp: new Date().toISOString() },
  });
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
app.use('/api/v1/weddings', weddingExtrasRouter);
app.use('/api/v1/weddings', weddingCoordinatorRouter);
app.use('/api/v1/weddings', weddingIncidentsRouter);
app.use('/api/v1/weddings', weddingDayOfRouter);
app.use('/api/v1/coordinator', coordinatorRouter);
app.use('/api/v1', publicRsvpRouter);
app.use('/api/v1/invites', invitesPublicRouter);
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
app.use('/api/v1/payments/subscriptions', subscriptionsRouter);
app.use('/api/v1/payments', paymentSplitsRouter);
app.use('/api/v1/payments/admin/export', csvExportRouter);
app.use('/api/v1/admin', adminVendorsRouter);
app.use('/api/v1/payments', reconciliationRouter);
app.use('/api/v1/rentals', rentalRouter);
app.use('/api/v1/store', storeRouter);
app.use('/api/v1/calendar', calendarRouter);
app.use('/api/v1/admin', escrowAdminRouter);
app.use('/api/v1/admin', stayQuotientAdminRouter);
app.use('/api/v1/admin', reputationAdminRouter);
app.use('/api/v1/admin', adminAnalyticsRouter);
app.use('/api/v1/admin', platformSettingsRouter);
app.use('/api/v1', platformSettingsPublicRouter);

// Internal service-to-service routes — NO session middleware, authenticated via
// X-Internal-Key header only. Must be mounted WITHOUT cors/session wrappers.
app.use('/internal', internalRouter);

// AI feature routes (Conversation Coach, etc.) — require Better Auth session.
app.use('/api/v1/ai', aiRouter);

// Phase 3 P3 Lite — Matrimony AI Assistant + Vendor Engine foundation.
registerP3Routes(app);

// Dev-only routes — mount synchronously BEFORE the 404/error handlers so errors
// thrown by dev handlers reach the global error middleware.
if (env.NODE_ENV === 'development') {
  app.use('/api/v1/dev', devRouter);
}

/**
 * Sentry verification endpoint.
 *
 * Gated behind SENTRY_TEST_ENABLED env flag (default false → 404).
 * Enable ONLY for production deploy verification, then disable.
 * SECURITY: This endpoint throws an unhandled exception — never expose
 * publicly without the flag gate. Leaving SENTRY_TEST_ENABLED=true in prod
 * gives any caller a one-shot 5xx generator and pollutes Sentry signal.
 */
app.get('/api/v1/sentry-test', (_req: Request, res: Response): void => {
  if (!env.SENTRY_TEST_ENABLED) {
    errResponse(res, 'NOT_FOUND', 'Route not found', 404);
    return;
  }
  res.locals['sentryTest'] = true;
  throw new Error(`Sentry test event — safe to ignore: ${new Date().toISOString()}`);
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
// Unknown paths must return the standard envelope, not Express's raw HTML.
app.use((req: Request, res: Response): void => {
  errResponse(res, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`, 404);
});

// ── Sentry error handler ──────────────────────────────────────────────────────
// Must run before the custom error middleware so Sentry captures the error
// before the catch-all converts it to a 500 envelope.
setupSentryErrorHandler(app);

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

  logger.error({ err: error, requestId: (_req as Request & { id?: string }).id }, 'unhandled error');
  captureException(error, { requestId: (_req as Request & { id?: string }).id });
  errResponse(res, 'INTERNAL_ERROR', 'Internal server error', 500);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandledRejection');
  captureException(reason);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  captureException(err);
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
  await initSocket(server);

  // Boot config summary — surfaces mock/live state for production debugging.
  // Look for this line in Railway logs to confirm env vars resolved as expected.
  const { shouldUseMockR2, shouldUseMockMongo } = await import('./lib/env.js');
  const { getSocketAdapterKind } = await import('./chat/socket/index.js');
  console.info('[boot] config summary:', {
    NODE_ENV: env.NODE_ENV,
    useMockServices: env.USE_MOCK_SERVICES,
    allowMockInProd: env.ALLOW_MOCK_SERVICES_IN_PROD,
    shouldUseMockR2,
    shouldUseMockMongo,
    socketAdapter: getSocketAdapterKind(),
    dailyApiKeySet: Boolean(env.DAILY_CO_API_KEY) && env.DAILY_CO_API_KEY !== 'mock-daily-key',
  });

  server.listen(env.PORT, () => {
    console.info(`API server running on port ${env.PORT}`);
  });

  // Workers — skip in mock/test mode to avoid connecting to Redis that isn't
  // configured, and to keep CI / vitest from holding live connections.
  // Workers that return their handle are tracked for graceful drain on SIGTERM.
  const workers: Array<{ close(): Promise<void> }> = [];
  if (!env.USE_MOCK_SERVICES) {
    workers.push(startGunaRecalcWorker());
    workers.push(registerEscrowReleaseWorker());
    workers.push(registerOrderExpiryWorker());
    workers.push(startAccountPurgeWorker());
    workers.push(registerMatchRequestExpiryWorker());
    void scheduleMatchRequestExpiryJob();
    workers.push(registerWeddingReminderWorker());
    void scheduleWeddingReminderJob();
    workers.push(registerWeddingCompletionWorker());
    workers.push(registerRsvpReminderWorker());
    workers.push(registerSaveTheDateWorker());
    workers.push(registerThankYouWorker());
    workers.push(registerTokenCleanupWorker());
    void scheduleTokenCleanupJob();
    workers.push(startNotificationsWorker());
    workers.push(registerInvitationBlastWorker());
    workers.push(registerAuditChainVerifierWorker());
    void scheduleAuditChainVerifierJob();
    workers.push(registerEmotionalScoreWorker());
    void scheduleEmotionalScoreJob();
    workers.push(registerHistoricalAttendanceWorker());
    void scheduleHistoricalAttendanceJob();
    workers.push(registerExpireGracePeriodsWorker());
    void scheduleExpireGracePeriodsJob();
    workers.push(registerBehaviorEventWorker());
    workers.push(registerBehaviorAggregateWorker());
    void scheduleBehaviorAggregateJob();
    workers.push(registerEmbeddingWorker());
    registerP3Workers(workers);
  }

  // Opt-in: run ONLY the notifications worker in mock/dev too, so the realtime
  // bell can be exercised locally without flipping USE_MOCK_SERVICES=false
  // (which would force real Razorpay/MSG91/Daily). Idempotent — no-ops if the
  // block above already started it. Providers still mock-guard individually.
  if (env.USE_MOCK_SERVICES && env.NOTIFICATIONS_WORKER_ENABLED) {
    workers.push(startNotificationsWorker());
  }

  // Graceful shutdown — Railway sends SIGTERM before killing containers.
  // Drain HTTP, BullMQ workers, Redis, Postgres, Mongo before exit.
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`${signal} received — shutting down gracefully`);

    // Hard cap: 30s total. Force exit if any step hangs.
    const forceTimer = setTimeout(() => {
      console.error('Forced shutdown after 30s timeout');
      process.exit(1);
    }, 30_000);

    try {
      await new Promise<void>((resolve) => {
        server.close(() => { console.info('HTTP server closed'); resolve(); });
      });

      if (workers.length > 0) {
        console.info(`draining ${workers.length} BullMQ workers`);
        await Promise.all(
          workers.map((w) => w.close().catch((e) => console.warn('worker.close failed', e))),
        );
      }

      try {
        const { redis } = await import('./lib/redis.js');
        await redis.quit();
        console.info('Redis disconnected');
      } catch (e) { console.warn('redis.quit failed', e); }

      try {
        const { pool } = await import('./lib/db.js');
        await pool.end();
        console.info('Postgres pool ended');
      } catch (e) { console.warn('pg pool.end failed', e); }

      try {
        const { mongoose } = await import('./lib/mongo.js');
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
          console.info('Mongo disconnected');
        }
      } catch (e) { console.warn('mongoose.disconnect failed', e); }

      clearTimeout(forceTimer);
      process.exit(0);
    } catch (e) {
      console.error('Shutdown error:', e);
      clearTimeout(forceTimer);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
}

void bootstrap();
