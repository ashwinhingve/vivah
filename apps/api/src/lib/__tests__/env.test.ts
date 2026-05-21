import { describe, it, expect } from 'vitest';
import { envSchema } from '../env.js';

const baseValidEnv = {
  DATABASE_URL: 'postgres://test',
  REDIS_URL: 'redis://test',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  AI_SERVICE_INTERNAL_KEY: 'real-internal-key-not-default',
};

describe('envSchema — production mock guard', () => {
  it('rejects NODE_ENV=production + USE_MOCK_SERVICES=true without override', () => {
    const result = envSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'production',
      USE_MOCK_SERVICES: 'true',
      MOCK_OTP_VALUE: 'abc12345',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mockIssue = result.error.issues.find(i => i.path[0] === 'USE_MOCK_SERVICES');
      expect(mockIssue).toBeDefined();
      expect(mockIssue?.message).toMatch(/Mock services cannot run in production/);
    }
  });

  it('allows NODE_ENV=production + USE_MOCK_SERVICES=true when ALLOW_MOCK_SERVICES_IN_PROD=true', () => {
    const result = envSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'production',
      USE_MOCK_SERVICES: 'true',
      ALLOW_MOCK_SERVICES_IN_PROD: 'true',
      MOCK_OTP_VALUE: 'abc12345',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.USE_MOCK_SERVICES).toBe(true);
      expect(result.data.ALLOW_MOCK_SERVICES_IN_PROD).toBe(true);
    }
  });

  it('still rejects production mock when override is literally "false"', () => {
    const result = envSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'production',
      USE_MOCK_SERVICES: 'true',
      ALLOW_MOCK_SERVICES_IN_PROD: 'false',
      MOCK_OTP_VALUE: 'abc12345',
    });
    expect(result.success).toBe(false);
  });

  it('override has no effect when NODE_ENV != production (dev/test mock-mode still works)', () => {
    const result = envSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'development',
      USE_MOCK_SERVICES: 'true',
      ALLOW_MOCK_SERVICES_IN_PROD: 'true',
      MOCK_OTP_VALUE: 'abc12345',
    });
    expect(result.success).toBe(true);
  });

  it('defaults ALLOW_MOCK_SERVICES_IN_PROD to false', () => {
    const result = envSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'development',
      USE_MOCK_SERVICES: 'true',
      MOCK_OTP_VALUE: 'abc12345',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ALLOW_MOCK_SERVICES_IN_PROD).toBe(false);
    }
  });
});
