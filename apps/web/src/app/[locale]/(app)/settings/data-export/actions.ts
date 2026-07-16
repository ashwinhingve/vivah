'use server';

import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export type ExportStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'DOWNLOADED'
  | 'FAILED';

export interface ExportRequest {
  id:                 string;
  status:            ExportStatus;
  requestedAt:       string;
  completedAt?:      string | null;
  downloadExpiresAt?: string | null;
  fileSizeBytes?:    number | null;
}

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  const token = store.get('better-auth.session_token')?.value ?? '';
  return `better-auth.session_token=${token}`;
}

/**
 * POST /api/v1/gdpr/export/request — enqueue a new data export.
 * Rate-limited to one per day by the API (429 → friendly message).
 */
export async function requestExportAction(): Promise<
  { ok: true; requestId: string } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/gdpr/export/request`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await cookieHeader() },
      cache:   'no-store',
    });
    if (res.status === 429) {
      return { ok: false, error: 'You can request one export per day. Please try again tomorrow.' };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? 'Could not start your export. Please try again.' };
    }
    const body = (await res.json()) as { success: boolean; data: { requestId: string } };
    return { ok: true, requestId: body.data.requestId };
  } catch {
    return { ok: false, error: 'Network error — please try again.' };
  }
}

/**
 * GET /api/v1/gdpr/export/:id/download — resolve a fresh, short-lived download URL.
 * Marks the row DOWNLOADED server-side.
 */
export async function getDownloadUrlAction(
  requestId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/gdpr/export/${requestId}/download`, {
      headers: { Cookie: await cookieHeader() },
      cache:   'no-store',
    });
    if (res.status === 410) {
      return { ok: false, error: 'This download link has expired. Please request a new export.' };
    }
    if (res.status === 409) {
      return { ok: false, error: 'Your export is not ready yet. Please refresh in a moment.' };
    }
    if (!res.ok) return { ok: false, error: 'Download is unavailable right now.' };
    const body = (await res.json()) as { success: boolean; data: { downloadUrl: string } };
    return { ok: true, url: body.data.downloadUrl };
  } catch {
    return { ok: false, error: 'Network error — please try again.' };
  }
}
