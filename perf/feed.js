/**
 * Smart Shaadi — Matchmaking Feed Performance Test (k6)
 *
 * Measures latency of the match feed endpoint under sustained load.
 * Simulates real user browsing: fetch feed, iterate through pagination.
 *
 * Endpoint: GET /api/v1/matchmaking/feed?page=1&limit=10
 *
 * Thresholds:
 *  - Feed response (cold): P95 < 1s
 *  - Feed response (warm, page 2): P95 < 500ms
 *  - Success rate: ≥99%
 *  - Circuit breaker: 0 open states (for outbound calls)
 *
 * See perf/BASELINE.md for measured numbers. Do not record baselines in this
 * header: the previous ones ("cold P95=280ms") were written without k6 ever
 * having been installed, and a fabricated baseline is worse than none — it
 * gets compared against.
 *
 * AUTH: the feed is authenticated. Pass a session cookie:
 *   AUTH_TOKEN="$(cat /tmp/k6cookie.txt)" k6 run perf/feed.js
 * Without it every request 401s and the run measures the auth middleware.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const feedLatency = new Trend('feed_latency', { unit: 'ms' });
const feedOffsetLatency = new Trend('feed_offset_latency', { unit: 'ms' });
const feedSuccessRate = new Rate('feed_success_rate');
const circuitBreakerOpen = new Counter('circuit_breaker_open');

const API_URL = __ENV.API_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// For authenticated requests, we need a session cookie.
// In local dev (mock mode), we can obtain one via the auth flow first.
// In production, pass AUTH_TOKEN with the session cookie.
const httpParams = {
  headers: {
    'Content-Type': 'application/json',
  },
  tags: { name: 'feed' },
};

// Add authorization if provided
if (AUTH_TOKEN) {
  httpParams.headers['Cookie'] = AUTH_TOKEN;
}

export const options = {
  scenarios: {
    feed_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },  // Ramp to 10 VUs
        { duration: '60s', target: 20 },  // Hold at 20 VUs for 1 min (main load)
        { duration: '15s', target: 0 },   // Ramp down
      ],
    },
  },
  thresholds: {
    feed_latency: ['p(95)<1000'],         // P95 < 1s for cold loads
    feed_offset_latency: ['p(95)<500'],   // P95 < 500ms for cached/offset
    feed_success_rate: ['rate>=0.99'],    // 99% success
    // `count`, not `value`: k6 rejects `value` on a Counter and REFUSES TO
    // START the run. That invalid threshold is why this script had never once
    // executed despite carrying a recorded baseline in its header.
    circuit_breaker_open: ['count==0'],   // No open breakers
  },
};

export default function () {
  // 1. Cold load — offset=0 (first page of feed)
  const feedRes = http.get(`${API_URL}/api/v1/matchmaking/feed?page=1&limit=10`, httpParams);

  feedLatency.add(feedRes.timings.duration);

  const feedOk = check(feedRes, {
    'feed: status 200': (r) => r.status === 200,
    'feed: has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data.items);
      } catch {
        return false;
      }
    },
  });

  if (!feedOk) {
    feedSuccessRate.add(false);
    // Check for circuit breaker open in error response
    try {
      const body = JSON.parse(feedRes.body);
      if (body.error?.code === 'SERVICE_UNAVAILABLE' || feedRes.status === 503) {
        circuitBreakerOpen.add(1);
      }
    } catch {
      // Ignore parse errors
    }
    return;
  }

  feedSuccessRate.add(true);
  sleep(1);

  // 2. Pagination — offset=10 (second page, tests cursor-based or offset-based)
  const offsetRes = http.get(`${API_URL}/api/v1/matchmaking/feed?page=2&limit=10`, httpParams);

  feedOffsetLatency.add(offsetRes.timings.duration);

  const offsetOk = check(offsetRes, {
    'feed offset: status 200': (r) => r.status === 200,
    'feed offset: has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data.items);
      } catch {
        return false;
      }
    },
  });

  if (!offsetOk) {
    feedSuccessRate.add(false);
    try {
      const body = JSON.parse(offsetRes.body);
      if (body.error?.code === 'SERVICE_UNAVAILABLE' || offsetRes.status === 503) {
        circuitBreakerOpen.add(1);
      }
    } catch {
      // Ignore
    }
  } else {
    feedSuccessRate.add(true);
  }

  sleep(2); // User browsing time
}
