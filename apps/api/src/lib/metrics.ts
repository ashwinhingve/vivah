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

/** Express middleware — auto-records http_requests_total for every route. */
export function metricsMiddleware(req: Request, res: Response, next: () => void): void {
  res.on('finish', () => {
    const route = req.route?.path ?? req.path ?? 'unknown';
    metrics.httpRequest(req.method, route, res.statusCode);
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
