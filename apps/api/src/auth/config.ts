import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins';
import { sql } from 'drizzle-orm';
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
        // TODO: real MSG91 integration when USE_MOCK_SERVICES=false
        // await msg91.sendOTP(phone, code);
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
  },

  trustedOrigins: [env.WEB_URL],
});

export type Auth = typeof auth;
