// ── User & Role Types ─────────────────────────────────────────────────────────

export type UserRole =
  | 'INDIVIDUAL'
  | 'FAMILY_MEMBER'
  | 'VENDOR'
  | 'EVENT_COORDINATOR'
  | 'ADMIN'
  | 'SUPPORT';

export type UserStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'PENDING_VERIFICATION'
  | 'DELETED';

export type OtpPurpose =
  | 'LOGIN'
  | 'REGISTRATION'
  | 'KYC'
  | 'CONTACT_UNLOCK'
  | 'PASSWORD_RESET';

// ── Session / JWT ─────────────────────────────────────────────────────────────

/** Better Auth session payload attached to req.user by the authenticate middleware. */
export interface SessionPayload {
  sub: string;       // userId (Better Auth user.id)
  role: UserRole;
  sessionId: string; // Better Auth session.id
}

export interface JwtPayload {
  sub: string;       // userId
  role: UserRole;
  sessionId: string; // links to sessions table
  type: 'access';
  iat: number;
  exp: number;
}

// ── Auth Response Shapes ──────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  /** Always masked: +91XXXXXX3210 */
  phone: string;
}

// ── Standard API Envelope ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
  meta: { timestamp: string; [key: string]: unknown };
}

export interface ApiError {
  success: false;
  data: null;
  error: { code: string; message: string; [key: string]: unknown };
  meta: { timestamp: string; [key: string]: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Error Codes ───────────────────────────────────────────────────────────────

export const AuthErrorCode = {
  INVALID_PHONE: 'INVALID_PHONE',
  USER_EXISTS: 'USER_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_SUSPENDED: 'USER_SUSPENDED',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];
