/**
 * Smart Shaadi — Lightweight Prometheus metrics emitter.
 *
 * Exposes /metrics in Prometheus exposition format using only Node.js stdlib.
 * Avoids the prom-client dep — counters + gauges + the four queue depths we
 * actually need are simple enough to maintain inline.
 *
 * If we outgrow this, swap to prom-client (drop-in API compatibility for the
 * counter / histogram / gauge primitives).
 */

import type { Request, Response } from 'express';
import {
  matchComputeQueue,
  notificationsQueue,
  escrowReleaseQueue,
  invitationBlastQueue,
} from '../infrastructure/redis/queues.js';
import { env } from './env.js';
import { getAllBreakerStates } from './circuit-breaker.js';

// ── Counters ─────────────────────────────────────────────────────────────────
const counters = new Map<string, number>();

function bumpCounter(name: string, labels: Record<string, string> = {}, by = 1): void {
  const key = serialize(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + by);
}

function serialize(name: string, labels: Record<string, string>): string {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
    .join(',');
  return labelStr ? `${name}{${labelStr}}` : name;
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// ── Histograms ───────────────────────────────────────────────────────────────
// HTTP request duration histogram: tracks P50/P95/P99 latency by route+method+status.
// Buckets (in seconds): 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
// Cardinality bounded by using route template (not raw URL with IDs).
interface HistogramBucket {
  le: number; // upper bound (seconds)
  count: number; // cumulative count <= le
}

interface Histogram {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

const histograms = new Map<string, Histogram>();

const HISTOGRAM_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function recordHistogram(name: string, labels: Record<string, string>, valueSeconds: number): void {
  const key = serialize(name, labels);
  let histogram = histograms.get(key);
  if (!histogram) {
    histogram = {
      buckets: HISTOGRAM_BUCKETS.map((le) => ({ le, count: 0 })),
      sum: 0,
      count: 0,
    };
    histograms.set(key, histogram);
  }

  // Increment bucket counts
  for (const bucket of histogram.buckets) {
    if (valueSeconds <= bucket.le) {
      bucket.count += 1;
    }
  }
  histogram.sum += valueSeconds;
  histogram.count += 1;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Increment a counter — typed access for the well-known metrics. */
export const metrics = {
  httpRequest(method: string, route: string, status: number): void {
    bumpCounter('http_requests_total', { method, route, status: String(status) });
  },
  webhookReceived(provider: string, event: string, outcome: 'ok' | 'duplicate' | 'failed'): void {
    bumpCounter('payment_webhooks_total', { provider, event, outcome });
  },
  paymentCaptured(amount: number): void {
    bumpCounter('payments_captured_total');
    bumpCounter('payments_captured_amount_total', {}, amount);
  },
  matchRequestCreated(): void {
    bumpCounter('match_requests_created_total');
  },
  bookingCreated(): void {
    bumpCounter('bookings_created_total');
  },
  disputeRaised(): void {
    bumpCounter('disputes_raised_total');
  },
};

/** Express middleware — auto-records http_requests_total and http_request_duration_seconds. */
export function metricsMiddleware(req: Request, res: Response, next: () => void): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const route = req.route?.path ?? req.path ?? 'unknown';
    metrics.httpRequest(req.method, route, res.statusCode);

    // Record histogram: duration in seconds
    const elapsedNs = process.hrtime.bigint() - startTime;
    const elapsedSeconds = Number(elapsedNs) / 1_000_000_000;
    recordHistogram('http_request_duration_seconds', {
      route,
      method: req.method,
      status: String(res.statusCode),
    }, elapsedSeconds);
  });
  next();
}

/** /metrics endpoint — Prometheus text exposition format. */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  const lines: string[] = [];

  // Process-level
  const mem = process.memoryUsage();
  lines.push('# HELP process_uptime_seconds Process uptime');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${process.uptime()}`);
  lines.push('# HELP process_memory_rss_bytes Resident set size');
  lines.push('# TYPE process_memory_rss_bytes gauge');
  lines.push(`process_memory_rss_bytes ${mem.rss}`);
  lines.push('# HELP process_memory_heap_used_bytes Heap used');
  lines.push('# TYPE process_memory_heap_used_bytes gauge');
  lines.push(`process_memory_heap_used_bytes ${mem.heapUsed}`);

  // Counters
  for (const [key, value] of counters) {
    const baseName = key.split('{')[0];
    lines.push(`# TYPE ${baseName} counter`);
    lines.push(`${key} ${value}`);
  }

  // Histograms — emit _bucket (with le label), _sum, _count
  // Group by base name to avoid duplicate TYPE headers
  const histogramsByName = new Map<string, Array<[string, Histogram]>>();
  for (const [key, histogram] of histograms) {
    const [baseName] = key.split('{');
    if (!baseName) continue; // Skip malformed keys
    if (!histogramsByName.has(baseName)) {
      histogramsByName.set(baseName, []);
    }
    histogramsByName.get(baseName)!.push([key, histogram]);
  }

  for (const [baseName, entries] of histogramsByName) {
    lines.push(`# HELP ${baseName} HTTP request duration in seconds`);
    lines.push(`# TYPE ${baseName} histogram`);

    for (const [baseKey, histogram] of entries) {
      const labels = baseKey.includes('{')
        ? baseKey.substring(baseName.length + 1, baseKey.length - 1)
        : '';
      // Emit buckets first
      for (const bucket of histogram.buckets) {
        const bucketLabel = labels ? `${labels},le="${bucket.le}"` : `le="${bucket.le}"`;
        lines.push(`${baseName}_bucket{${bucketLabel}} ${bucket.count}`);
      }
      // +Inf bucket is always count (all samples)
      const infLabel = labels ? `${labels},le="+Inf"` : 'le="+Inf"';
      lines.push(`${baseName}_bucket{${infLabel}} ${histogram.count}`);
      // Emit sum and count
      lines.push(`${baseName}_sum${labels ? `{${labels}}` : ''} ${histogram.sum}`);
      lines.push(`${baseName}_count${labels ? `{${labels}}` : ''} ${histogram.count}`);
    }
  }

  // Circuit breaker states (0=closed, 1=half-open, 2=open)
  lines.push('# HELP circuit_breaker_state External service circuit breaker state (0=closed, 1=half-open, 2=open)');
  lines.push('# TYPE circuit_breaker_state gauge');
  const breakerStates = getAllBreakerStates();
  for (const [service, state] of Object.entries(breakerStates)) {
    lines.push(`circuit_breaker_state{service="${service}"} ${state}`);
  }

  // Bull queue depths (skip in mock mode — would error)
  if (!env.USE_MOCK_SERVICES) {
    const queues: Array<[string, { getJobCounts: () => Promise<Record<string, number>> }]> = [
      ['match-compute', matchComputeQueue],
      ['notifications', notificationsQueue],
      ['escrow-release', escrowReleaseQueue],
      ['invitation-blast', invitationBlastQueue],
    ];

    lines.push('# HELP bull_queue_depth BullMQ queue depth by state');
    lines.push('# TYPE bull_queue_depth gauge');
    for (const [name, queue] of queues) {
      try {
        const counts = await queue.getJobCounts();
        for (const [state, n] of Object.entries(counts)) {
          lines.push(`bull_queue_depth{queue="${name}",state="${state}"} ${n}`);
        }
      } catch {
        // queue unreachable — emit a single failure marker
        lines.push(`bull_queue_depth{queue="${name}",state="unreachable"} 1`);
      }
    }
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n') + '\n');
}
