import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { phoneNumber, twoFactor } from 'better-auth/plugins';
import { sql, eq as drizzleEq } from 'drizzle-orm';
import { user, session, account, verification, twoFactor as twoFactorTable } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { recordAuthEvent, isNewDevice, AuthEventType } from './events.js';
import { recordOtpSent, recordOtpFailure, recordOtpSuccess, isPhoneLocked } from './otpLockout.js';

/**
 * Pulls the best-available IP for an authenticated request. Better Auth
 * normalises x-forwarded-for via its trustHosts setting.
 */
function ipFrom(headers: Headers | undefined): string | null {
  if (!headers) return null;
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return headers.get('x-real-ip');
}

function uaFrom(headers: Headers | undefined): string | null {
  return headers?.get('user-agent') ?? null;
}

export const auth = betterAuth({
  // Pass the four auth tables explicitly. The drizzle() instance is created
  // without a full schema (one re-exported namespace entry is null under
  // compiled CJS interop and crashes drizzle's extractor), so the adapter
  // needs its own schema hint here.
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification, twoFactor: twoFactorTable },
  }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_BASE_URL,

  session: {
    expiresIn: 60 * 60 * 24 * 30,           // 30 days
    updateAge: 60 * 60 * 24,                  // refresh session daily
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5-min client cache
    storeSessionInDatabase: true,
  },

  // Cookie flags — tokens never touch localStorage (CLAUDE.md rule).
  advanced: {
    // Keep cookie name as `better-auth.session_token` in both dev and prod.
    // By default Better Auth prefixes the cookie with `__Secure-` when the
    // baseURL is https, which would force every server-side fetch in the web
    // app to know about two possible names. Disable the prefix and keep the
    // Secure/HttpOnly/SameSite attributes below for the same protections.
    useSecureCookies: false,
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          secure:   env.NODE_ENV === 'production',
          sameSite: 'lax',
          // Share the cookie across subdomains in prod so the Next.js app on
          // smartshaadi.co.in can read the session set by the API on
          // api.smartshaadi.co.in. The leading dot scopes it to the
          // registrable domain.
          ...(env.NODE_ENV === 'production' ? { domain: '.smartshaadi.co.in' } : {}),
        },
      },
    },
  },

  emailAndPassword: { enabled: true },

  // Soft-delete: when the security-router /me/account/delete endpoint calls
  // auth.api.deleteUser, the deletion is queued via the database hook below
  // (we mark deletion_requested_at instead of hard-deleting). Hard purge runs
  // from a daily cron after the 30-day grace window.
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'INDIVIDUAL',
      },
      status: {
        type: 'string',
        required: false,
        defaultValue: 'PENDING_VERIFICATION',
      },
      twoFactorEnabled: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
      deletionRequestedAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },

  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: phone, code }, request) => {
        const headers = (request as unknown as { headers?: Headers })?.headers;
        const ip = ipFrom(headers);
        const ua = uaFrom(headers);

        // Lockout check — block before the verification row is even written.
        if (await isPhoneLocked(phone)) {
          recordAuthEvent({ userId: null, type: AuthEventType.OTP_LOCKED, ipAddress: ip, userAgent: ua, metadata: { phone } });
          throw new Error('Too many OTP requests for this number. Try again in 15 minutes.');
        }

        await recordOtpSent(phone);
        recordAuthEvent({ userId: null, type: AuthEventType.OTP_SENT, ipAddress: ip, userAgent: ua, metadata: { phone } });

        if (env.USE_MOCK_SERVICES) {
          const mockCode = env.MOCK_OTP_VALUE;
          console.info(`[MOCK OTP] ${phone}: ${code} → overriding with ${mockCode}`);
          // Better Auth already stored the random OTP; replace with the mock
          // value so the configured code always works in mock mode.
          await db.execute(
            sql`UPDATE verification SET value = ${`${mockCode}:0`} WHERE identifier = ${phone}`,
          );
          return;
        }
        // Fail loud in real mode until MSG91 is wired up — silent no-op would
        // make the UX say "code sent" when nothing was delivered.
        if (!env.MSG91_API_KEY) {
          throw new Error('MSG91 not configured — set USE_MOCK_SERVICES=true or MSG91_API_KEY');
        }
        // TODO: real MSG91 integration
        throw new Error('MSG91 integration not yet implemented');
      },
      // Auto-create user on first OTP verify (phone-first signup flow).
      // Temp email is derived from phone — user sets real email in profile later.
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace('+', '')}@phone.smartshaadi.co.in`,
        getTempName: (phone) => phone,
      },
      expiresIn: 600, // 10 minutes
      otpLength: 6,
      // Hard cap on how many wrong codes one verification row tolerates before
      // Better Auth invalidates it. We layer per-phone Redis lockout on top
      // (otpLockout.ts) for cross-row brute force.
      allowedAttempts: 5,
    }),
    twoFactor({
      issuer: 'Smart Shaadi',
      // Phone-OTP-first users have no credential password; without this flag
      // /two-factor/enable would 400 with PASSWORD_REQUIRED.
      allowPasswordless: true,
      skipVerificationOnEnable: false,
    }),
  ],

  /**
   * Request-level hooks. We use `hooks.after` to detect verify-otp failures
   * (the only signal we can reliably catch is the response status code on the
   * outbound side) and record per-phone failure counters in Redis. Lockout
   * applied on the next sendOtp call.
   */
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      try {
        const path = ctx.path;
        if (path !== '/phone-number/verify-otp') return;
        const status = (ctx.context.returned as { status?: number } | undefined)?.status;
        // Better Auth returns APIError instances with `.status` for failures.
        // 200 means success — handled in databaseHooks.session.create.after.
        if (!status || status === 200) return;
        const phone = (ctx.body as { phoneNumber?: string } | undefined)?.phoneNumber;
        if (!phone) return;
        const ip = ipFrom(ctx.request?.headers);
        const ua = uaFrom(ctx.request?.headers);
        const result = await recordOtpFailure(phone);
        recordAuthEvent({
          userId: null,
          type: result.locked ? AuthEventType.OTP_LOCKED : AuthEventType.OTP_FAILED,
          ipAddress: ip,
          userAgent: ua,
          metadata: { phone, failures: result.failures, remaining: result.remaining },
        });
      } catch (error) {
        console.warn('[auth-hooks] verify-otp after-hook failed', error);
      }
    }),
  },

  rateLimit: {
    enabled: true,
    window: 600, // 10-minute window
    max: 3,      // 3 OTP requests per window per identifier
    customRules: {
      '/get-session':              { window: 10,  max: 200 },
      '/sign-out':                 { window: 60,  max: 20  },
      '/two-factor/verify-totp':   { window: 60,  max: 10  },
      '/two-factor/verify-backup': { window: 600, max: 5   },
      '/delete-user':              { window: 600, max: 3   },
    },
  },

  trustedOrigins: [env.WEB_URL],

  /**
   * Lifecycle hooks → audit log.
   *
   * - `session.create.after` fires on every successful sign-in (phone OTP,
   *   email/password, social, etc). This is where LOGIN_SUCCESS lands and
   *   where we run new-device detection.
   * - `user.create.after` fires once on first OTP verification (autosignup)
   *   or explicit sign-up.
   * - `session.delete.before` fires on sign-out and on revoke-session calls.
   * - `user.delete.before` fires on account deletion. We block the hard
   *   delete and mark deletionRequestedAt so the account enters its 30-day
   *   recovery window instead of being purged.
   */
  databaseHooks: {
    user: {
      create: {
        after: async (newUser, ctx) => {
          const ip = ipFrom(ctx?.request?.headers);
          const ua = uaFrom(ctx?.request?.headers);
          recordAuthEvent({
            userId: newUser.id,
            type: AuthEventType.ACCOUNT_REGISTERED,
            ipAddress: ip,
            userAgent: ua,
            metadata: { phone: (newUser as { phoneNumber?: string }).phoneNumber ?? null },
          });
        },
      },
      delete: {
        before: async (deleted, ctx) => {
          const ip = ipFrom(ctx?.request?.headers);
          const ua = uaFrom(ctx?.request?.headers);
          recordAuthEvent({
            userId: deleted.id,
            type: AuthEventType.ACCOUNT_DELETED,
            ipAddress: ip,
            userAgent: ua,
          });
        },
      },
    },
    session: {
      create: {
        after: async (sess, ctx) => {
          const ip = ipFrom(ctx?.request?.headers) ?? sess.ipAddress ?? null;
          const ua = uaFrom(ctx?.request?.headers) ?? sess.userAgent ?? null;
          // OTP_VERIFIED for phone-flow visibility. The phoneNumber plugin
          // creates a session right after a verify; we attribute the verify
          // to the same session-create event.
          recordAuthEvent({
            userId: sess.userId,
            type: AuthEventType.OTP_VERIFIED,
            ipAddress: ip,
            userAgent: ua,
          });
          // Reset OTP lockout counter — successful auth means the user is
          // legit, brute-force window must close immediately.
          if (sess.userId) {
            try {
              const [u] = await db
                .select({ phoneNumber: user.phoneNumber })
                .from(user)
                .where(drizzleEq(user.id, sess.userId))
                .limit(1);
              if (u?.phoneNumber) await recordOtpSuccess(u.phoneNumber);
            } catch {
              // best-effort
            }
          }
          recordAuthEvent({
            userId: sess.userId,
            type: AuthEventType.LOGIN_SUCCESS,
            ipAddress: ip,
            userAgent: ua,
            metadata: { sessionId: sess.id },
          });
          // New-device detection runs against history excluding the row we
          // just wrote — the LOGIN_SUCCESS row is fire-and-forget so the
          // count below sees the prior state.
          const fresh = await isNewDevice(sess.userId, ip, ua);
          if (fresh) {
            recordAuthEvent({
              userId: sess.userId,
              type: AuthEventType.NEW_DEVICE_LOGIN,
              ipAddress: ip,
              userAgent: ua,
              metadata: { sessionId: sess.id },
            });
          }
        },
      },
      delete: {
        before: async (sess, ctx) => {
          const ip = ipFrom(ctx?.request?.headers);
          const ua = uaFrom(ctx?.request?.headers);
          recordAuthEvent({
            userId: sess.userId ?? null,
            type: AuthEventType.LOGOUT,
            ipAddress: ip,
            userAgent: ua,
            metadata: { sessionId: sess.id },
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;

// Re-export so callers can record OTP failures from the verify endpoint hook
// in router.ts without depending on otpLockout.ts directly.
export { recordOtpFailure };
