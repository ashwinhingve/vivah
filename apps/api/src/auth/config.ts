import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins';
import { sql } from 'drizzle-orm';
import { user, session, account, verification } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';

export const auth = betterAuth({
  // Pass the four auth tables explicitly. The drizzle() instance is created
  // without a full schema (one re-exported namespace entry is null under
  // compiled CJS interop and crashes drizzle's extractor), so the adapter
  // needs its own schema hint here.
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
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
        },
      },
    },
  },

  emailAndPassword: { enabled: true },

  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: phone, code }) => {
        if (env.USE_MOCK_SERVICES) {
          console.info(`[MOCK OTP] ${phone}: ${code} → overriding with 123456`);
          // Better Auth already stored the random OTP; replace with 123456 so
          // the fixed mock code always works during development.
          await db.execute(
            sql`UPDATE verification SET value = '123456:0' WHERE identifier = ${phone}`,
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
    }),
  ],

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
    },
  },

  rateLimit: {
    enabled: true,
    window: 600, // 10-minute window
    max: 3,      // 3 OTP requests per window per identifier
    customRules: {
      '/get-session': { window: 10, max: 200 },
      '/sign-out':    { window: 60, max: 20 },
    },
  },

  trustedOrigins: [env.WEB_URL],
});

export type Auth = typeof auth;
