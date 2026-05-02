'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

interface KycRow {
  profileId: string;
  userId: string;
  verificationStatus: string;
  verificationLevel: string | null;
  aadhaarVerified: boolean | null;
  panVerified: boolean | null;
  bankVerified: boolean | null;
  livenessScore: number | null;
  faceMatchScore: number | null;
  riskScore: number | null;
  duplicateFlag: boolean | null;
  duplicateReason: string | null;
  sanctionsHit: boolean | null;
  attemptCount: number | null;
  submittedAt: string | null;
}

interface Props { initialRows: KycRow[] }

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type Filter = 'ALL' | 'DUPLICATES' | 'SANCTIONS' | 'HIGH_RISK' | 'LOW_RISK';

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(s));
}

function riskBadgeClass(score: number | null): string {
  if (score === null) return 'bg-muted/30 text-muted-foreground';
  if (score >= 80) return 'bg-success/10 text-success';
  if (score >= 50) return 'bg-warning/10 text-warning';
  return 'bg-destructive/10 text-destructive';
}

export function KycQueueTable({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');

  const filtered = useMemo(() => {
    let out = rows.slice();
    if (filter === 'DUPLICATES') out = out.filter(r => r.duplicateFlag);
    if (filter === 'SANCTIONS')  out = out.filter(r => r.sanctionsHit);
    if (filter === 'HIGH_RISK')  out = out.filter(r => (r.riskScore ?? 0) < 50);
    if (filter === 'LOW_RISK')   out = out.filter(r => (r.riskScore ?? 0) >= 80);
    return out.sort((a, b) => (a.riskScore ?? 0) - (b.riskScore ?? 0));
  }, [rows, filter]);

  async function reviewKyc(profileId: string, action: 'approve' | 'reject') {
    setLoading(profileId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/kyc/${profileId}/${action}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ note: 'Rejected from queue' }) : '{}',
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(json.error?.message ?? 'Action failed');
        return;
      }
      setRows((prev) => prev.filter((r) => r.profileId !== profileId));
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gold/40 bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-primary">KYC queue empty</p>
        <p className="text-xs text-muted-foreground mt-1">All profiles reviewed</p>
      </div>
    );
  }

  const filterBtn = (k: Filter, label: string, count: number) => (
    <button onClick={() => setFilter(k)}
      className={`text-xs font-semibold rounded-full px-3 py-1 transition-colors ${
        filter === k ? 'bg-primary text-white' : 'bg-muted/40 text-foreground hover:bg-muted/60'
      }`}>
      {label} <span className="opacity-70 ml-1">{count}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {filterBtn('ALL', 'All', rows.length)}
        {filterBtn('HIGH_RISK', 'High risk', rows.filter(r => (r.riskScore ?? 0) < 50).length)}
        {filterBtn('LOW_RISK', 'Low risk', rows.filter(r => (r.riskScore ?? 0) >= 80).length)}
        {filterBtn('DUPLICATES', 'Duplicates', rows.filter(r => r.duplicateFlag).length)}
        {filterBtn('SANCTIONS', 'Sanctions', rows.filter(r => r.sanctionsHit).length)}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gold/30 bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-3 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Profile</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Risk</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Level</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Signals</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Flags</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Submitted</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-primary uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.profileId} className="border-b border-border last:border-0 hover:bg-background/50">
                <td className="px-3 py-3 font-mono text-[11px] text-foreground">
                  <Link href={`/admin/kyc/${row.profileId}`} className="hover:underline text-primary">
                    {row.profileId.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center text-[11px] font-semibold rounded-full px-2 py-0.5 ${riskBadgeClass(row.riskScore)}`}>
                    {row.riskScore ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs">
                  <span className="font-semibold text-foreground">{row.verificationLevel ?? 'NONE'}</span>
                </td>
                <td className="px-3 py-3 text-xs">
                  <div className="flex gap-1 flex-wrap">
                    {row.aadhaarVerified && <span className="rounded-full bg-success/10 text-success px-1.5 py-0.5 text-[10px] font-semibold">AADHAAR</span>}
                    {row.panVerified && <span className="rounded-full bg-success/10 text-success px-1.5 py-0.5 text-[10px] font-semibold">PAN</span>}
                    {row.bankVerified && <span className="rounded-full bg-success/10 text-success px-1.5 py-0.5 text-[10px] font-semibold">BANK</span>}
                    {row.livenessScore !== null && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        row.livenessScore >= 70 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>L:{row.livenessScore}</span>
                    )}
                    {row.faceMatchScore !== null && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        row.faceMatchScore >= 75 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>F:{row.faceMatchScore}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs">
                  <div className="flex gap-1 flex-wrap">
                    {row.duplicateFlag && <span className="rounded-full bg-warning/10 text-warning px-1.5 py-0.5 text-[10px] font-semibold">DUP</span>}
                    {row.sanctionsHit && <span className="rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-semibold">SANCTIONS</span>}
                    {(row.attemptCount ?? 0) >= 3 && <span className="rounded-full bg-warning/10 text-warning px-1.5 py-0.5 text-[10px] font-semibold">×{row.attemptCount}</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(row.submittedAt)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Link href={`/admin/kyc/${row.profileId}`}
                      className="px-2 py-1 rounded-lg bg-muted/40 text-foreground text-xs font-semibold hover:bg-muted/60 transition-colors">
                      View
                    </Link>
                    <button onClick={() => void reviewKyc(row.profileId, 'approve')}
                      disabled={loading === row.profileId}
                      className="px-2 py-1 rounded-lg bg-teal text-white text-xs font-semibold hover:bg-teal-hover transition-colors disabled:opacity-50">
                      {loading === row.profileId ? '…' : 'Approve'}
                    </button>
                    <button onClick={() => void reviewKyc(row.profileId, 'reject')}
                      disabled={loading === row.profileId}
                      className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive text-xs font-semibold hover:bg-destructive/5 transition-colors disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
