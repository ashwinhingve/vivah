/**
 * Smart Shaadi — Auth Flow Performance Test (k6)
 *
 * Measures latency of the phone OTP login flow:
 * 1. POST /api/auth/phone-number/send-otp — request an OTP
 * 2. POST /api/auth/phone-number/verify   — verify it (mock '123456' in dev)
 *
 * These are Better Auth's own routes. The script previously posted to
 * /api/auth/phone and /api/auth/verify-otp, which do not exist, with a body
 * keyed `phone` rather than `phoneNumber`, and asserted on `body.success` —
 * a field Better Auth never returns (it answers {message} and {status,token},
 * not the app's {success,data,error,meta} envelope). Every request 404'd.
 *
 * Thresholds:
 *  - sendPhone response: P95 < 2s
 *  - verifyOtp response: P95 < 1.5s
 *  - Success rate: >=99%
 *
 * See perf/BASELINE.md for measured numbers. No baseline is recorded in this
 * header: the previous one was written without k6 ever having been run.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom metrics — exported to summary at end of test
const sendPhoneLatency = new Trend('sendPhone_latency', { unit: 'ms' });
const verifyOtpLatency = new Trend('verifyOtp_latency', { unit: 'ms' });
const loginSuccessRate = new Rate('login_success_rate');

// Configuration — override via env vars
const API_URL = __ENV.API_URL || 'http://localhost:4000';
// One number per VU, from a bounded pool. A single shared number would
// serialise every VU on one user row and measure lock contention rather than
// auth latency; an unbounded per-iteration number would create a new user on
// every loop and grow the dev database without limit.
const PHONE_POOL_SIZE = 20;
// Override per run (PHONE_BLOCK=00002 ...) to avoid reusing an identifier whose
// 3-per-10-minute OTP quota is still burned from a previous run.
const PHONE_BLOCK = __ENV.PHONE_BLOCK || '00001';
function phoneForVu() {
  const suffix = String(__VU % PHONE_POOL_SIZE).padStart(2, '0');
  return `+9195${PHONE_BLOCK}${suffix}`;
}
const MOCK_OTP = __ENV.MOCK_OTP_VALUE || '123456';

export const options = {
  scenarios: {
    // NOT a ramping load test, on purpose.
    //
    // Better Auth caps OTP sends at 3 per 10-minute window per identifier
    // (rateLimit in apps/api/src/auth/config.ts). A sustained ramp therefore
    // measures the RATE LIMITER, not the auth path: a 5-VU/50s ramp produced
    // 4349 429s against 9 real logins, and the "latency" it reported was the
    // limiter rejecting requests. That limiter is a deliberate anti-abuse
    // control and must not be raised to make a graph look better.
    //
    // MEASURED 2026-07-19: the quota is keyed by SOURCE IP, not by phone
    // number. Twenty VUs on twenty never-before-seen numbers from one host
    // still produced 20/20 429s. Varying the identifier does not help; only
    // varying the source address does.
    //
    // CONSEQUENCE: this script cannot produce a valid auth baseline from a
    // single load generator. A run that trips `login_success_rate` has
    // measured the limiter and must NOT be recorded as a latency baseline.
    // To get real numbers, either run distributed load from multiple source
    // IPs, or stand up a dedicated perf environment with the Better Auth
    // rateLimit block relaxed — and never relax it anywhere user-facing.
    login_flow: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    sendPhone_latency: ['p(95)<2000'],
    verifyOtp_latency: ['p(95)<1500'],
    login_success_rate: ['rate>=0.99'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  // 1. Request OTP to test phone
  const phoneNumber = phoneForVu();
  const sendPhoneRes = http.post(
    `${API_URL}/api/auth/phone-number/send-otp`,
    JSON.stringify({ phoneNumber }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { name: 'sendPhone' },
    },
  );

  sendPhoneLatency.add(sendPhoneRes.timings.duration);
  const sendPhoneOk = check(sendPhoneRes, {
    'sendPhone: status 200': (r) => r.status === 200,
    'sendPhone: code sent': (r) => {
      try {
        return typeof JSON.parse(r.body).message === 'string';
      } catch {
        return false;
      }
    },
  });

  if (!sendPhoneOk) {
    loginSuccessRate.add(false);
    return;
  }

  sleep(1); // Brief pause before verifying OTP

  // 2. Verify OTP code
  // In mock mode, MOCK_OTP_VALUE from env must match the code we send
  const verifyOtpRes = http.post(
    `${API_URL}/api/auth/phone-number/verify`,
    JSON.stringify({ phoneNumber, code: MOCK_OTP }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { name: 'verifyOtp' },
    },
  );

  verifyOtpLatency.add(verifyOtpRes.timings.duration);
  const verifyOtpOk = check(verifyOtpRes, {
    'verifyOtp: status 200': (r) => r.status === 200,
    'verifyOtp: session issued': (r) => {
      try {
        const body = JSON.parse(r.body);
        // A session token is the only proof the login actually succeeded.
        return body.status === true && typeof body.token === 'string';
      } catch {
        return false;
      }
    },
    'verifyOtp: session cookie set': (r) =>
      r.headers['Set-Cookie'] && r.headers['Set-Cookie'].includes('better-auth.session_token'),
  });

  loginSuccessRate.add(verifyOtpOk);

  sleep(2); // Realistic delay before next iteration
}
