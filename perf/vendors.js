/**
 * Smart Shaadi — Vendor Discovery Performance Test (k6)
 *
 * The public vendor listing is the heaviest UNAUTHENTICATED read in the app and
 * the one a marketing push points at, so it is the endpoint most likely to be
 * hit by a cold crowd. It is also the only load script here that runs against a
 * genuinely populated table locally (168 approved vendors from the demo seed),
 * which makes its numbers the most transferable of the three.
 *
 * Endpoints:
 *   GET /api/v1/vendors                    — unfiltered first page
 *   GET /api/v1/vendors?category=&city=    — filtered (exercises the ILIKE path)
 *   GET /api/v1/vendors?page=N             — deep pagination (OFFSET cost)
 *
 * No auth required. `isFavorite` is only populated when a session is present,
 * so an unauthenticated run measures the cheaper path — which is the correct
 * one to measure here, since that is what an anonymous visitor gets.
 *
 * See perf/BASELINE.md for measured numbers.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const listLatency = new Trend('vendor_list_latency', { unit: 'ms' });
const filteredLatency = new Trend('vendor_filtered_latency', { unit: 'ms' });
const deepPageLatency = new Trend('vendor_deep_page_latency', { unit: 'ms' });
const successRate = new Rate('vendor_success_rate');

const API_URL = __ENV.API_URL || 'http://localhost:4000';

const httpParams = {
  headers: { 'Content-Type': 'application/json' },
  tags: { name: 'vendors' },
};

export const options = {
  scenarios: {
    vendor_browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '60s', target: 20 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    vendor_list_latency: ['p(95)<800'],
    vendor_filtered_latency: ['p(95)<800'],
    // Deep pagination is allowed to be slower: it is an OFFSET scan, and the
    // point of measuring it separately is to see HOW MUCH slower before that
    // becomes a keyset-pagination decision.
    vendor_deep_page_latency: ['p(95)<1200'],
    vendor_success_rate: ['rate>=0.99'],
  },
};

/** Asserts the envelope actually carries vendors, not just a 200. */
function checkVendorPage(res, label) {
  const ok = check(res, {
    [`${label}: status 200`]: (r) => r.status === 200,
    [`${label}: has vendors array`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data.vendors);
      } catch {
        return false;
      }
    },
  });
  successRate.add(ok);
  return ok;
}

export default function () {
  // 1. Unfiltered first page — what the browse tab opens on.
  const listRes = http.get(`${API_URL}/api/v1/vendors?limit=20`, httpParams);
  listLatency.add(listRes.timings.duration);
  checkVendorPage(listRes, 'list');
  sleep(1);

  // 2. Filtered — category equality plus a city ILIKE, the common search shape.
  const filteredRes = http.get(
    `${API_URL}/api/v1/vendors?category=PHOTOGRAPHY&city=Mumbai&limit=20`,
    httpParams,
  );
  filteredLatency.add(filteredRes.timings.duration);
  checkVendorPage(filteredRes, 'filtered');
  sleep(1);

  // 3. Deep page — OFFSET grows linearly and this is where it shows.
  const deepRes = http.get(`${API_URL}/api/v1/vendors?page=6&limit=20`, httpParams);
  deepPageLatency.add(deepRes.timings.duration);
  checkVendorPage(deepRes, 'deep');
  sleep(2);
}
