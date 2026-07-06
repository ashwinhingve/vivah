'use client';

import { CheckCircle, AlertCircle, Circle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceCheck {
  ok: boolean;
  label: string;
}

interface AiModel {
  name: string;
  ok: boolean;
}

interface Props {
  /** postgres / redis / mongo check results from /ready */
  serviceChecks: ServiceCheck[];
  /** AI model availability from AI-service /health — null if unreachable */
  aiModels: AiModel[] | null;
  atRiskItems: AtRiskUser[];
  atRiskTotal: number;
}

interface AtRiskUser {
  userId: string;
  riskBand: string;
  score: number | null;
  displayName: string | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <Circle className="h-2.5 w-2.5 shrink-0 fill-success text-success" aria-hidden />
  ) : (
    <Circle className="h-2.5 w-2.5 shrink-0 fill-destructive text-destructive" aria-hidden />
  );
}

/** Safely truncate a possibly-undefined string — never throws on undefined,
 *  so a future API-shape drift can't reintroduce the `undefined.slice()` 500. */
function short(s: string | null | undefined, n: number): string {
  return typeof s === 'string' && s.length > 0 ? s.slice(0, n) : '—';
}

function riskBandClass(band: string): string {
  const b = (band ?? '').toUpperCase();
  if (b === 'HIGH' || b === 'CRITICAL') return 'bg-destructive/10 text-destructive';
  if (b === 'MEDIUM') return 'bg-warning/10 text-warning';
  return 'bg-muted/40 text-text-muted';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminHealthAndRisk({
  serviceChecks,
  aiModels,
  atRiskItems,
  atRiskTotal,
}: Props) {
  const allOk = serviceChecks.every((c) => c.ok);
  const degradedCount = serviceChecks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-6">
      {/* ── System health strip ── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          {allOk ? (
            <CheckCircle className="h-4 w-4 text-success" strokeWidth={2} />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" strokeWidth={2} />
          )}
          <span className="text-sm font-semibold text-text-primary">
            {allOk ? 'All systems operational' : `${degradedCount} service${degradedCount > 1 ? 's' : ''} degraded`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {serviceChecks.map((check) => (
            <div
              key={check.label}
              className="flex items-center gap-2 rounded-xl border border-gold/20 bg-surface px-4 py-3"
            >
              <StatusDot ok={check.ok} />
              <span className="text-xs font-medium text-text-primary capitalize">
                {check.label}
              </span>
              <span
                className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${check.ok ? 'text-success' : 'text-destructive'}`}
              >
                {check.ok ? 'OK' : 'ERR'}
              </span>
            </div>
          ))}
        </div>

        {/* AI models row — omit gracefully if AI service is unreachable */}
        {aiModels !== null && aiModels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {aiModels.map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-1.5 rounded-lg border border-gold/20 bg-surface px-3 py-1.5"
              >
                <StatusDot ok={m.ok} />
                <span className="text-[11px] font-medium text-text-muted">{m.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI service unreachable — clearly commented */}
        {/* TODO: AI-service health URL is not exposed via NEXT_PUBLIC env; /ready only covers postgres·redis·mongo.
            To add AI health, expose NEXT_PUBLIC_AI_SERVICE_URL and fetch ${AI_SERVICE_URL}/health server-side. */}
        {aiModels === null && (
          <p className="mt-2 text-[11px] text-text-muted">
            AI service health — not reachable from web layer (see TODO in AdminHealthAndRisk.client.tsx)
          </p>
        )}

        {/* TODO: no endpoint for API request count or error rate — show "—" placeholders */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-gold/20 bg-surface px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              API Requests / hr
            </p>
            {/* TODO: no endpoint for real-time request count — wire once metrics service ships */}
            <p className="mt-1 font-heading text-xl font-semibold text-text-primary">—</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Error Rate
            </p>
            {/* TODO: no endpoint for error rate — wire from Sentry when metrics endpoint ships */}
            <p className="mt-1 font-heading text-xl font-semibold text-text-primary">—</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              P95 Latency
            </p>
            {/* TODO: no endpoint — wire from BetterStack or APM once available */}
            <p className="mt-1 font-heading text-xl font-semibold text-text-primary">—</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Uptime (30d)
            </p>
            {/* TODO: no endpoint — pull from BetterStack monitor once configured */}
            <p className="mt-1 font-heading text-xl font-semibold text-text-primary">—</p>
          </div>
        </div>
      </section>

      {/* ── At-risk users ── */}
      {atRiskItems.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text-primary">
              At-risk users
              <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                {atRiskTotal}
              </span>
            </span>
            {/* No dedicated at-risk route exists yet — omit link per brief */}
          </div>
          <div className="overflow-hidden rounded-xl border border-gold/20 bg-surface">
            <div className="divide-y divide-gold/10">
              {atRiskItems.map((u) => (
                <div key={u.userId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {u.displayName ?? short(u.userId, 8) + '…'}
                    </p>
                    <p className="font-mono text-[10px] text-text-muted">
                      {short(u.userId, 12)}…
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskBandClass(u.riskBand)}`}
                  >
                    {(u.riskBand ?? '').toUpperCase()}
                  </span>
                  {u.score !== null && (
                    <span className="text-[10px] font-medium text-text-muted">
                      {Math.round(u.score * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
