/**
 * Smart Shaadi — Analytics & Reporting Performance Test (k6)
 *
 * Measures latency of admin analytics and statistics endpoints under sustained load.
 * Simulates admin dashboard refresh + deep-dive analytics queries.
 *
 * Endpoints:
 *  - GET /api/v1/admin/stats — Summary dashboard (simple aggregates)
 *  - GET /api/v1/admin/analytics/... — Detailed cohort analysis (compute-heavy)
 *
 * Thresholds:
 *  - Stats (fast aggregates): P95 < 1.5s
 *  - Analytics (compute-heavy): P95 < 2s
 *  - Success rate: ≥95% (slower due to compute, occasional timeouts OK)
 *
 * Baseline (recorded 2026-07-18, local dev):
 *  - stats: P95=320ms
 *  - analytics: P95=450ms
 *
 * Notes:
 *  - Requires ADMIN or SUPPORT role (test account: qa-admin-01, phone 7000000401)
 *  - These are read-only queries, safe to hammer in load test
 *  - Compute-heavy aggregations may spike under high concurrency
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const statsLatency = new Trend('analytics_stats_latency', { unit: 'ms' });
const analyticsLatency = new Trend('analytics_query_latency', { unit: 'ms' });
const analyticsSuccessRate = new Rate('analytics_success_rate');
const timeoutCounter = new Counter('analytics_timeouts');

const API_URL = __ENV.API_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

const httpParams = {
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: '30s',
  tags: { name: 'analytics' },
};

if (AUTH_TOKEN) {
  httpParams.headers['Cookie'] = AUTH_TOKEN;
}

export const options = {
  scenarios: {
    analytics_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },   // Ramp to 5 VUs
        { duration: '60s', target: 10 },  // Hold at 10 VUs
        { duration: '10s', target: 0 },   // Ramp down
      ],
    },
  },
  thresholds: {
    analytics_stats_latency: ['p(95)<1500'],    // P95 < 1.5s
    analytics_query_latency: ['p(95)<2000'],    // P95 < 2s
    analytics_success_rate: ['rate>=0.95'],     // 95% success (lower threshold for compute)
    analytics_timeouts: ['count<10'],           // Fewer than 10 timeouts total
  },
};

export default function () {
  // 1. Quick stats endpoint — dashboard summary
  // Common queries: active users, total revenue, match requests, etc.
  const statsRes = http.get(`${API_URL}/api/v1/admin/stats`, httpParams);

  statsLatency.add(statsRes.timings.duration);

  const statsOk = check(statsRes, {
    'stats: status 200': (r) => r.status === 200,
    'stats: has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.data !== null;
      } catch {
        return false;
      }
    },
    'stats: not 401/403': (r) => r.status !== 401 && r.status !== 403,
  });

  if (!statsOk) {
    analyticsSuccessRate.add(false);
    if (statsRes.status >= 500) {
      timeoutCounter.add(1);
    }
  } else {
    analyticsSuccessRate.add(true);
  }

  sleep(1);

  // 2. Deeper analytics — the revenue rollup, which aggregates over payments
  // and is the compute-heavy read on the admin dashboard.
  //
  // This previously pointed at `/api/v1/admin/analytics?metric=retention`,
  // which DOES NOT EXIST — it 404s. The check below accepted "200 or 404", so
  // half of every run measured the latency of Express's not-found handler and
  // reported it as an analytics baseline. The route is now the real one
  // (mounted at '/api/v1/payments/admin/analytics' in apps/api/src/index.ts)
  // and 404 is no longer an accepted outcome.
  const analyticsRes = http.get(
    `${API_URL}/api/v1/payments/admin/analytics/summary`,
    httpParams,
  );

  analyticsLatency.add(analyticsRes.timings.duration);

  const analyticsOk = check(analyticsRes, {
    'analytics: status 200': (r) => r.status === 200,
    'analytics: not 401': (r) => r.status !== 401,
    'analytics: completes before 30s': (r) => r.timings.duration < 30000,
  });

  if (!analyticsOk) {
    analyticsSuccessRate.add(false);
    if (analyticsRes.status === 0 || analyticsRes.timings.duration >= 30000) {
      timeoutCounter.add(1);
    }
  } else {
    analyticsSuccessRate.add(true);
  }

  sleep(2);
}
