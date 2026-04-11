import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { env } from '../lib/env.js';
import type { JwtPayload, UserRole } from '@smartshaadi/types';

const SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ACCESS_TTL = '15m';

export async function signAccess(payload: {
  userId: string;
  role: UserRole;
  sessionId: string;
}): Promise<string> {
  return new SignJWT({
    role: payload.role,
    sessionId: payload.sessionId,
    type: 'access' as const,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(SECRET);
}

export async function verifyAccess(token: string): Promise<JwtPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });

    if (payload['type'] !== 'access') {
      throw new Error('Not an access token');
    }

    return payload as unknown as JwtPayload;
  } catch (e) {
    if (e instanceof joseErrors.JWTExpired) {
      const expired = new Error('TOKEN_EXPIRED');
      expired.name = 'TOKEN_EXPIRED';
      throw expired;
    }
    const invalid = new Error('TOKEN_INVALID');
    invalid.name = 'TOKEN_INVALID';
    throw invalid;
  }
}
