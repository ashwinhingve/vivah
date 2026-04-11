import { randomBytes } from 'crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { signAccess } from './jwt.js';
import {
  generate6,
  hashOtp,
  verifyOtpHash,
  otpExpiresAt,
  sendViaMSG91,
  maskPhone,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_LIMIT_SECONDS,
} from './otp.js';
import { AuthErrorCode } from '@smartshaadi/types';
import type { UserRole, AuthUser, OtpPurpose } from '@smartshaadi/types';

// Schema tables (compiled @smartshaadi/db re-exports all from schema/index.ts)
import {
  users,
  sessions,
  otpVerifications,
} from '@smartshaadi/db';

// ── Redis key helper ──────────────────────────────────────────────────────────

function sessionKey(tokenHash: string): string {
  return `session:${tokenHash}`;
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// ── Register ──────────────────────────────────────────────────────────────────

export interface RegisterResult {
  maskedPhone: string;
}

export async function register(phone: string, role: UserRole = 'INDIVIDUAL'): Promise<RegisterResult> {
  // Check duplicate
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (existing.length > 0) {
    const err = new Error(AuthErrorCode.USER_EXISTS);
    err.name = AuthErrorCode.USER_EXISTS;
    throw err;
  }

  // Create user in PENDING_VERIFICATION state
  await db.insert(users).values({
    phone,
    role,
    status: 'PENDING_VERIFICATION',
  });

  await sendOtp(phone, 'REGISTRATION');

  return { maskedPhone: maskPhone(phone) };
}

// ── Send OTP ──────────────────────────────────────────────────────────────────

export async function sendOtp(phone: string, purpose: OtpPurpose): Promise<void> {
  // Rate-limit: reject if a valid unused OTP was sent in the last 60s
  const rateLimitCutoff = new Date(Date.now() - OTP_RATE_LIMIT_SECONDS * 1000);
  const recent = await db
    .select({ id: otpVerifications.id })
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.purpose, purpose),
        gt(otpVerifications.createdAt, rateLimitCutoff),
        isNull(otpVerifications.usedAt),
      ),
    )
    .limit(1);

  if (recent.length > 0) {
    const err = new Error(AuthErrorCode.OTP_RATE_LIMITED);
    err.name = AuthErrorCode.OTP_RATE_LIMITED;
    throw err;
  }

  const otp = generate6();
  const otpHash = hashOtp(String(otp), phone, purpose);
  const expiresAt = otpExpiresAt();

  await db.insert(otpVerifications).values({
    phone,
    otpHash,
    purpose,
    attempts: 0,
    expiresAt,
  });

  await sendViaMSG91(phone, otp);
}

// ── Login (send OTP to existing user) ────────────────────────────────────────

export async function loginPhone(phone: string): Promise<void> {
  const user = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (user.length === 0) {
    const err = new Error(AuthErrorCode.USER_NOT_FOUND);
    err.name = AuthErrorCode.USER_NOT_FOUND;
    throw err;
  }

  if (user[0]?.status === 'SUSPENDED') {
    const err = new Error(AuthErrorCode.USER_SUSPENDED);
    err.name = AuthErrorCode.USER_SUSPENDED;
    throw err;
  }

  await sendOtp(phone, 'LOGIN');
}

// ── Verify OTP & issue tokens ─────────────────────────────────────────────────

export interface VerifyOtpResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function verifyOtpAndLogin(
  phone: string,
  otp: string,
  purpose: OtpPurpose,
): Promise<VerifyOtpResult> {
  // Find the most recent unexpired OTP record for this phone+purpose
  const record = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.usedAt),
        gt(otpVerifications.expiresAt, new Date()),
      ),
    )
    .orderBy(otpVerifications.createdAt)
    .limit(1);

  if (record.length === 0) {
    const err = new Error(AuthErrorCode.OTP_EXPIRED);
    err.name = AuthErrorCode.OTP_EXPIRED;
    throw err;
  }

  const otpRecord = record[0]!;

  // Check attempt limit
  if ((otpRecord.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    const err = new Error(AuthErrorCode.OTP_MAX_ATTEMPTS);
    err.name = AuthErrorCode.OTP_MAX_ATTEMPTS;
    throw err;
  }

  const candidateHash = hashOtp(otp, phone, purpose);
  const valid = verifyOtpHash(candidateHash, otpRecord.otpHash);

  if (!valid) {
    // Increment attempt counter
    await db
      .update(otpVerifications)
      .set({ attempts: (otpRecord.attempts ?? 0) + 1 })
      .where(eq(otpVerifications.id, otpRecord.id));

    const err = new Error(AuthErrorCode.OTP_INVALID);
    err.name = AuthErrorCode.OTP_INVALID;
    throw err;
  }

  // Mark OTP as used
  await db
    .update(otpVerifications)
    .set({ usedAt: new Date() })
    .where(eq(otpVerifications.id, otpRecord.id));

  // Fetch (or verify) the user
  const userRows = await db
    .select({ id: users.id, role: users.role, status: users.status, phone: users.phone })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (userRows.length === 0) {
    const err = new Error(AuthErrorCode.USER_NOT_FOUND);
    err.name = AuthErrorCode.USER_NOT_FOUND;
    throw err;
  }

  const user = userRows[0]!;

  // Mark user as ACTIVE after first verification
  if (user.status === 'PENDING_VERIFICATION') {
    await db
      .update(users)
      .set({ status: 'ACTIVE', verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    user.status = 'ACTIVE';
  }

  // Create session
  const refreshToken = randomBytes(32).toString('hex');
  const tokenHash = hashOtp(refreshToken, '', 'LOGIN'); // reuse SHA-256 utility
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const sessionRows = await db
    .insert(sessions)
    .values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })
    .returning({ id: sessions.id });

  const sessionId = sessionRows[0]!.id;

  // Cache session in Redis
  await redis.set(
    sessionKey(tokenHash),
    JSON.stringify({ userId: user.id, role: user.role, sessionId }),
    'EX',
    SESSION_TTL_SECONDS,
  );

  const accessToken = await signAccess({ userId: user.id, role: user.role, sessionId });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      role: user.role,
      status: user.status as AuthUser['status'],
      phone: maskPhone(user.phone),
    },
  };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string;
}

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  const tokenHash = hashOtp(refreshToken, '', 'LOGIN');

  // Fast path: Redis
  const cached = await redis.get(sessionKey(tokenHash));
  if (cached !== null) {
    const { userId, role, sessionId } = JSON.parse(cached) as {
      userId: string;
      role: UserRole;
      sessionId: string;
    };
    const accessToken = await signAccess({ userId, role, sessionId });
    return { accessToken };
  }

  // Fallback: DB
  const sessionRows = await db
    .select({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (sessionRows.length === 0) {
    const err = new Error(AuthErrorCode.TOKEN_INVALID);
    err.name = AuthErrorCode.TOKEN_INVALID;
    throw err;
  }

  const session = sessionRows[0]!;

  const userRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (userRows.length === 0) {
    const err = new Error(AuthErrorCode.TOKEN_INVALID);
    err.name = AuthErrorCode.TOKEN_INVALID;
    throw err;
  }

  const role = userRows[0]!.role;

  // Re-warm Redis
  const remainingSeconds = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
  await redis.set(
    sessionKey(tokenHash),
    JSON.stringify({ userId: session.userId, role, sessionId: session.id }),
    'EX',
    remainingSeconds,
  );

  const accessToken = await signAccess({ userId: session.userId, role, sessionId: session.id });
  return { accessToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashOtp(refreshToken, '', 'LOGIN');

  await Promise.all([
    redis.del(sessionKey(tokenHash)),
    db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)),
  ]);
}
