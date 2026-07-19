# Smart Shaadi Performance Test Suite

Load testing and performance baseline collection using k6.

## Setup

Install k6:
- **macOS**: `brew install k6`
- **Linux**: `sudo apt-get install k6` (Ubuntu/Debian) or equivalent
- **Windows**: Download from https://github.com/grafana/k6/releases

Verify installation:
```bash
k6 version
```

## Environment

All scripts require a running API server and authenticated session cookie.

### Local Development

```bash
# Terminal 1: Start the API
cd /repo
pnpm dev

# Terminal 2: Run tests against local dev (USE_MOCK_SERVICES=true)
# Scripts will authenticate via mock OTP
k6 run perf/auth.js --vus 1 --duration 30s

# Run individual test suites
k6 run perf/feed.js --vus 10 --duration 60s
k6 run perf/analytics.js --vus 5 --duration 60s
```

### Staging / Production

Set `API_URL` and `AUTH_TOKEN` env vars:

```bash
export API_URL=https://api.staging.smartshaadi.co.in
export AUTH_TOKEN="Bearer <actual-session-token>"
k6 run perf/feed.js --vus 50 --duration 300s
```

## Test Suites

### auth.js
**Purpose**: Verify OTP login flow latency and throughput.

**Thresholds**:
- Login response time: P95 < 2s
- OTP verification: P95 < 1.5s
- Success rate: ≥99%

**Metrics**: Uses real `/api/auth/phone` + `/api/auth/verify-otp` endpoints.

### feed.js
**Purpose**: Load-test the match feed endpoint and pagination.

**Thresholds**:
- Feed response: P95 < 1s
- Pagination (offset): P95 < 500ms
- Success rate: ≥99%
- Circuit breaker state: 0 open (if breaker is integrated)

**Metrics**: Hits `/api/v1/matchmaking/feed` with pagination, measures latency by offset.

### vendors.js
**Purpose**: Load-test the public vendor listing — the heaviest unauthenticated
read, and the only script here that runs against a genuinely populated table
locally (168 approved vendors from the demo seed).

**Thresholds**:
- List / filtered: P95 < 800ms
- Deep pagination: P95 < 1200ms (looser on purpose — it is an OFFSET scan, and
  measuring it separately is how we will see when that stops being viable)
- Success rate: ≥99%

**Auth**: none. Run it directly.

### analytics.js
**Purpose**: Verify analytics & reporting endpoints under sustained load.

**Thresholds**:
- Analytics query: P95 < 2s
- Admin stats: P95 < 1.5s
- Success rate: ≥95% (slower due to compute)

**Metrics**: Hits `/api/v1/admin/stats` and related endpoints.

## Baseline Recording

Measured baselines live in **`perf/BASELINE.md`**, with the run metadata
(date, k6 version, environment, dataset size) attached to the numbers.

**Do not record baselines in script headers.** That is how this suite ended up
carrying three sets of invented numbers: headers said "cold P95=280ms" and
"sendPhone: P95=450ms" while k6 was not installed on the machine and all three
scripts were too broken to execute. A number with no run behind it is worse
than a blank — a blank invites measurement, a fabricated number invites
comparison.

A baseline entry is only valid if it states where it was measured. A loopback
number and a staging number are different kinds of fact and must never be put
in the same column without saying which is which.

## Running Full Suite

```bash
k6 run perf/auth.js --vus 10 --duration 120s
k6 run perf/feed.js --vus 20 --duration 180s
k6 run perf/analytics.js --vus 10 --duration 120s
```

## Integration with CI/CD

Not currently integrated into GitHub Actions. To add:
1. Configure k6 Cloud credentials in Railway
2. Add a `perf-test` job to `.github/workflows/ci.yml`
3. Run against staging on every `main` push
4. Alert if P95 regresses >10% from baseline

## Useful k6 Patterns

### Custom Metrics
```javascript
import { Trend } from 'k6/metrics';
const loginTime = new Trend('login_time');
loginTime.add(response.timings.duration);
```

### Gradual Ramp-Up
```bash
k6 run script.js --stage 30s:50 --stage 30s:100 --stage 30s:50
```

### Live Monitoring
```bash
k6 run script.js --out=cloud
```

## Troubleshooting

**"Connection refused"**: API server not running. Start it first: `pnpm dev`

**"Unauthorized (401)"**: Authentication failed. Check:
- Mock OTP value matches `MOCK_OTP_VALUE` env var
- Session cookie is being set and sent in subsequent requests

**"Too many requests (429)"**: Hit rate limiter. Reduce `--vus` or add delays between requests.

**"Circuit breaker open"**: Indicates an outbound service (Razorpay, MSG91, Daily.co) is failing. Check monitoring.
