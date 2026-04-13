import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_BASE_URL,

  session: {
    expiresIn: 60 * 60 * 24 * 30,           // 30 days
    updateAge: 60 * 60 * 24,                  // refresh session daily
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5-min client cache
    storeSessionInDatabase: true,
  },

  emailAndPassword: { enabled: true },

  plugins: [
    phoneNumber({
      sendOTP: ({ phoneNumber: phone, code }) => {
        if (env.USE_MOCK_SERVICES === 'true') {
          console.info(`[MOCK OTP] ${phone}: ${code}`);
          return;
        }
        // TODO: real MSG91 integration when USE_MOCK_SERVICES=false
        // await msg91.sendOTP(phone, code);
      },
      verifyOTP: ({ code }) => {
        // In mock mode, always accept 123456 regardless of what was sent.
        // Return undefined (not false) to let Better Auth do DB verification in prod.
        if (env.USE_MOCK_SERVICES === 'true') {
          return Promise.resolve(code === '123456');
        }
        // Return undefined to fall through to Better Auth's built-in DB check
        return Promise.resolve(undefined as unknown as boolean);
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
  },

  trustedOrigins: [env.WEB_URL],
});

export type Auth = typeof auth;
