/**
 * Smart Shaadi — k6 load test
 *
 * Targets: /profiles/matches and /bookings — the two highest-throughput user-
 * facing endpoints. Goal: sustain 100 RPS for 5 min with p95 < 500ms.
 *
 * Run:
 *   k6 run tools/load/k6.js
 *
 * Targets a staging URL by default; override:
 *   k6 run -e BASE_URL=https://api.smartshaadi.co.in tools/load/k6.js
 *
 * Auth: this script does NOT log in — it hits public endpoints + uses a
 * pre-issued staging session cookie (read from STAGING_SESSION_COOKIE env).
 * Setup (once): run a real login, copy the session cookie, export it.
 *   export STAGING_SESSION_COOKIE='better-auth.session_token=...'
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://staging-api.smartshaadi.co.in';
const SESSION_COOKIE = __ENV.STAGING_SESSION_COOKIE || '';

// Custom metrics
const errorRate = new Rate('errors');
const p95Latency = new Trend('p95_latency');

export const options = {
  scenarios: {
    matches_browse: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 50 },   // warm up to 50 RPS
        { duration: '1m',  target: 100 },  // ramp to 100 RPS
        { duration: '3m',  target: 100 },  // sustain 100 RPS for 3 min
        { duration: '30s', target: 0 },    // ramp down
      ],
      exec: 'browseMatches',
    },
    bookings_list: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 50 },
        { duration: '3m',  target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'listBookings',
    },
  },

  thresholds: {
    // Acceptance criteria from stabilization plan §1.4
    'http_req_duration{scenario:matches_browse}': ['p(95)<500'],
    'http_req_duration{scenario:bookings_list}':  ['p(95)<500'],
    'http_req_failed':                            ['rate<0.01'], // <1% errors
    errors:                                       ['rate<0.01'],
  },
};

const headers = SESSION_COOKIE
  ? { Cookie: SESSION_COOKIE, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' };

export function browseMatches() {
  const res = http.get(`${BASE_URL}/api/v1/profiles/matches?limit=20`, { headers });

  check(res, {
    'status is 200':         (r) => r.status === 200,
    'response has data':     (r) => r.json('data') !== null,
    'latency under 500ms':   (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  p95Latency.add(res.timings.duration);

  sleep(0.1); // tiny think-time
}

export function listBookings() {
  const res = http.get(`${BASE_URL}/api/v1/bookings?limit=10`, { headers });

  check(res, {
    'status is 200':       (r) => r.status === 200,
    'response is JSON':    (r) => r.headers['Content-Type']?.includes('json'),
    'latency under 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  p95Latency.add(res.timings.duration);

  sleep(0.2);
}

// Smoke test variant — run with `k6 run --tag scenario=smoke tools/load/k6.js`
export function smoke() {
  const health = http.get(`${BASE_URL}/health`);
  check(health, { '/health is 200': (r) => r.status === 200 });

  const ready = http.get(`${BASE_URL}/ready`);
  check(ready, { '/ready is 200': (r) => r.status === 200 });
}
