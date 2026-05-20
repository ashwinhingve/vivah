'use client';

import { useState } from 'react';
import { uploadDocumentAction } from './actions';

const TYPES = [
  { value: 'PASSPORT',              label: 'Passport' },
  { value: 'VOTER_ID',              label: 'Voter ID' },
  { value: 'DRIVING_LICENSE',       label: 'Driving licence' },
  { value: 'UTILITY_BILL',          label: 'Utility bill (address proof)' },
  { value: 'BANK_STATEMENT',        label: 'Bank statement' },
  { value: 'EMPLOYMENT_LETTER',     label: 'Employment letter' },
  { value: 'EDUCATION_CERTIFICATE', label: 'Education certificate' },
  { value: 'OTHER',                 label: 'Other' },
] as const;

interface ExistingDoc {
  documentType: string;
  status: string;
  documentLast4: string | null;
  uploadedAt: string;
  rejectionReason: string | null;
}
interface Props { documents: ExistingDoc[] }

export function DocumentUpload({ documents }: Props) {
  const [docType, setDocType] = useState<typeof TYPES[number]['value']>('PASSPORT');
  const [last4, setLast4] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10 MB'); return; }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // In prod: PUT to signed R2 URL first, then send the resulting key.
      // Dev stub: synthesise a key from filename + timestamp.
      const r2Key = `kyc-docs/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const res = await uploadDocumentAction({
        documentType: docType,
        r2Key,
        ...(last4 ? { documentLast4: last4 } : {}),
      });
      if (res.ok) {
        setSuccess(`${docType.replace(/_/g, ' ').toLowerCase()} submitted for review`);
        setLast4('');
        e.target.value = '';
      } else {
        setError(res.error ?? 'Upload failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Supplementary documents</h3>
        <p className="text-xs text-muted-foreground mt-1">Add passport, voter ID, utility bill or other proofs to strengthen your verification.</p>
      </div>

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.documentType + d.uploadedAt} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{d.documentType.replace(/_/g, ' ').toLowerCase()}</p>
                {d.documentLast4 && <p className="text-xs text-muted-foreground">Ending {d.documentLast4}</p>}
                {d.rejectionReason && <p className="text-xs text-destructive mt-1">{d.rejectionReason}</p>}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                d.status === 'VERIFIED' ? 'bg-success/10 text-success' :
                d.status === 'REJECTED' ? 'bg-destructive/10 text-destructive' :
                d.status === 'EXPIRED'  ? 'bg-warning/10 text-warning' :
                                          'bg-muted text-muted-foreground'
              }`}>{d.status}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-foreground">Document type</span>
          <select value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-foreground">Last 4 of document number (optional)</span>
          <input value={last4} onChange={(e) => setLast4(e.target.value.toUpperCase())} maxLength={8}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-foreground">Upload file (≤ 10 MB)</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => void handleFile(e)} disabled={busy}
            className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal file:px-3 file:py-2 file:text-white file:text-xs file:font-semibold" />
        </label>
        {busy && <p className="text-xs text-muted-foreground">Uploading…</p>}
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        {success && <p className="text-xs text-success" role="status">{success}</p>}
      </div>
    </div>
  );
}
