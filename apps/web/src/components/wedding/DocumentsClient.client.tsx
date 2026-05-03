'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { R2Uploader } from './R2Uploader.client';
import type { WeddingDocument, DocumentType } from '@smartshaadi/types';

const TYPES: DocumentType[] = ['CONTRACT', 'RECEIPT', 'INVOICE', 'PERMIT', 'INSURANCE', 'ID', 'OTHER'];

interface Props {
  weddingId: string;
  initialDocs: WeddingDocument[];
  addAction: (weddingId: string, data: { r2Key: string; label: string; type: string; fileSize?: number; mimeType?: string }) => Promise<void>;
  deleteAction: (weddingId: string, docId: string) => Promise<void>;
}

export function DocumentsClient({ weddingId, initialDocs, addAction, deleteAction }: Props) {
  const router = useRouter();
  const [type, setType] = useState<DocumentType>('CONTRACT');
  const [label, setLabel] = useState('');
  const [, startTransition] = useTransition();

  async function handleUploaded(r2Key: string, file: File) {
    if (!label.trim()) {
      alert('Please enter a label first');
      return;
    }
    await addAction(weddingId, {
      r2Key,
      label,
      type,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    });
    setLabel('');
    startTransition(() => router.refresh());
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAction(weddingId, id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-primary mb-3">Upload document</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Label *</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Photographer contract"
              className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as DocumentType)}
              className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm">
              {TYPES.map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <R2Uploader folder="documents" accept="image/*,application/pdf" label="Upload file" onUploaded={handleUploaded} />
        </div>
      </div>

      {initialDocs.length === 0 ? (
        <div className="bg-surface border border-dashed border-gold/30 rounded-xl p-12 text-center">
          <FileText className="h-10 w-10 text-gold mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        </div>
      ) : (
        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gold/10 bg-background text-left">
                <th className="px-4 py-2 font-medium text-muted-foreground">Label</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Size</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">Uploaded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {initialDocs.map(d => (
                <tr key={d.id} className="border-b border-gold/10 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.label}</a>
                    ) : d.label}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.type.toLowerCase()}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{d.fileSize ? `${Math.round(d.fileSize / 1024)} KB` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(d.id)} className="text-xs text-destructive hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
