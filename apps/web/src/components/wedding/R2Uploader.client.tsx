'use client';

import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  folder: 'photos' | 'documents';
  accept?: string;
  label?: string;
  onUploaded: (r2Key: string, file: File) => Promise<void> | void;
}

export function R2Uploader({ folder, accept = 'image/*', label = 'Upload', onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const presignRes = await fetch(`${API_URL}/api/v1/storage/upload-url`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          folder,
        }),
      });
      const presignJson = await presignRes.json() as { success: boolean; data?: { uploadUrl: string; r2Key: string }; error?: { message?: string } };
      if (!presignJson.success || !presignJson.data) throw new Error(presignJson.error?.message ?? 'Upload URL failed');
      const { uploadUrl, r2Key } = presignJson.data;

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error('Upload failed');

      await onUploaded(r2Key, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="inline-flex items-center gap-2 cursor-pointer min-h-[40px] px-4 rounded-lg bg-[#7B2D42] text-white text-sm font-medium hover:bg-[#5f2233]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? 'Uploading…' : label}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
