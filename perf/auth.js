/**
 * Smart Shaadi — Auth Flow Performance Test (k6)
 *
 * Measures latency of phone OTP login flow:
 * 1. POST /api/auth/phone — request OTP to a test phone number
 * 2. POST /api/auth/verify-otp — verify OTP code (mocked as '123456' in dev)
 *
 * Uses seeded test account: qa-ind-01 (phone 7000000001, landline +91-7000000001)
 *
 * Thresholds:
 *  - sendPhone response: P95 < 2s
 *  - verifyOtp response: P95 < 1.5s
 *  - Success rate: ≥99%
 *
 * Baseline (recorded 2026-07-18, local dev):
 *  - sendPhone: P95=450ms
 *  - verifyOtp: P95=320ms
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
const TEST_PHONE = '7000000001'; // qa-ind-01 seeded account
const MOCK_OTP = __ENV.MOCK_OTP_VALUE || '123456';

export const options = {
  scenarios: {
    login_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 2 },   // Ramp up to 2 VUs over 10s
        { duration: '30s', target: 5 },   // Hold at 5 VUs for 30s
        { duration: '10s', target: 0 },   // Ramp down to 0 over 10s
      ],
    },
  },
  thresholds: {
    sendPhone_latency: ['p(95)<2000'],        // P95 < 2s
    verifyOtp_latency: ['p(95)<1500'],        // P95 < 1.5s
    login_success_rate: ['rate>=0.99'],       // 99% success
    http_req_duration: ['p(95)<3000'],        // Aggregate
  },
};

export default function () {
  // 1. Request OTP to test phone
  const sendPhoneRes = http.post(
    `${API_URL}/api/auth/phone`,
    JSON.stringify({ phone: `+91${TEST_PHONE}` }),
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
    'sendPhone: success flag': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
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
    `${API_URL}/api/auth/verify-otp`,
    JSON.stringify({ phone: `+91${TEST_PHONE}`, code: MOCK_OTP }),
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
    'verifyOtp: success flag': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
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
