'use client';

import { useState } from 'react';

interface KycRow {
  profileId: string;
  userId: string;
  verificationStatus: string;
  aadhaarVerified: boolean | null;
  duplicateFlag: boolean | null;
  duplicateReason: string | null;
  submittedAt: string | null;
}

interface Props {
  initialRows: KycRow[];
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function KycQueueTable({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reviewKyc(profileId: string, action: 'approve' | 'reject') {
    setLoading(profileId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/kyc/${profileId}/${action}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ reason: 'Manual rejection' }) : '{}',
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? 'Action failed');
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
      <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-[#7B2D42]">KYC queue empty</p>
        <p className="text-xs text-[#6B6B76] mt-1">All profiles reviewed</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="rounded-xl border border-[#C5A47E]/30 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E0D8] bg-[#FEFAF6]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#7B2D42] uppercase tracking-wide">
                Profile
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#7B2D42] uppercase tracking-wide hidden sm:table-cell">
                Aadhaar
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#7B2D42] uppercase tracking-wide hidden sm:table-cell">
                Duplicate
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#7B2D42] uppercase tracking-wide hidden sm:table-cell">
                Submitted
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#7B2D42] uppercase tracking-wide">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.profileId} className="border-b border-[#E8E0D8] last:border-0">
                <td className="px-4 py-3 text-[#2E2E38] font-mono text-xs">
                  {row.profileId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {row.aadhaarVerified ? (
                    <span className="text-[#059669] text-xs font-semibold">Yes</span>
                  ) : (
                    <span className="text-[#D97706] text-xs font-semibold">No</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {row.duplicateFlag ? (
                    <span className="text-red-600 text-xs font-semibold">Flagged</span>
                  ) : (
                    <span className="text-[#6B6B76] text-xs">Clear</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#6B6B76] hidden sm:table-cell">
                  {row.submittedAt
                    ? new Date(row.submittedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => void reviewKyc(row.profileId, 'approve')}
                      disabled={loading === row.profileId}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0E7C7B] text-white text-xs font-semibold min-h-[32px] hover:bg-[#149998] transition-colors disabled:opacity-50"
                    >
                      {loading === row.profileId ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => void reviewKyc(row.profileId, 'reject')}
                      disabled={loading === row.profileId}
                      className="px-2.5 py-1.5 rounded-lg border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold min-h-[32px] hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
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
