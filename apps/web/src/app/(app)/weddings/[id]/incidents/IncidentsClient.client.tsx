'use client';

import { useState, useTransition } from 'react';
import type { WeddingIncident } from '@smartshaadi/types';
import { useToast } from '@/components/ui/toast';

interface Props {
  weddingId: string;
  initial: WeddingIncident[];
}

export function IncidentsClient({ weddingId, initial }: Props) {
  const [incidents, setIncidents] = useState<WeddingIncident[]>(initial);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [, startTx] = useTransition();
  const { toast } = useToast();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast('Title required', 'error'); return; }
    startTx(async () => {
      const res = await fetch(`${apiBase}/api/v1/weddings/${weddingId}/incidents`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, severity }),
      });
      const json = await res.json();
      if (json?.success && json.data) {
        setIncidents((xs) => [json.data as WeddingIncident, ...xs]);
        setTitle(''); setDescription(''); setSeverity('MEDIUM'); setOpen(false);
        toast('Incident raised', 'success');
      } else {
        toast(json?.error?.message ?? 'Failed to raise incident', 'error');
      }
    });
  };

  const resolve = (id: string) => {
    const note = window.prompt('How was it resolved?');
    if (!note?.trim()) return;
    startTx(async () => {
      const res = await fetch(`${apiBase}/api/v1/weddings/${weddingId}/incidents/${id}/resolve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: note }),
      });
      const json = await res.json();
      if (json?.success && json.data) {
        setIncidents((xs) => xs.map((x) => (x.id === id ? (json.data as WeddingIncident) : x)));
        toast('Resolved', 'success');
      } else {
        toast(json?.error?.message ?? 'Failed to resolve', 'error');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {open ? 'Cancel' : 'Raise incident'}
        </button>
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-foreground/10 bg-surface p-4 shadow-sm">
          <div>
            <label htmlFor="inc-title" className="block text-xs font-medium text-foreground">Title</label>
            <input
              id="inc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
              placeholder="Vendor running 30 min late"
            />
          </div>
          <div>
            <label htmlFor="inc-desc" className="block text-xs font-medium text-foreground">Description (optional)</label>
            <textarea
              id="inc-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3}
              className="mt-1 w-full rounded-md border border-foreground/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="inc-sev" className="text-xs font-medium text-foreground">Severity</label>
            <select
              id="inc-sev" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className="rounded-md border border-foreground/15 px-2 py-1 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <button
              type="submit"
              className="ml-auto rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      ) : null}

      {incidents.length > 0 ? (
        <ul className="divide-y divide-foreground/5 rounded-xl border border-foreground/10 bg-surface shadow-sm">
          {incidents.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{i.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    i.severity === 'CRITICAL' ? 'bg-destructive text-destructive' :
                    i.severity === 'HIGH'     ? 'bg-warning/20 text-warning' :
                    i.severity === 'MEDIUM'   ? 'bg-warning/15 text-warning' :
                    'bg-foreground/10 text-foreground'
                  }`}>
                    {i.severity}
                  </span>
                </div>
                {i.description ? <p className="mt-1 text-sm text-muted-foreground">{i.description}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(i.createdAt).toLocaleString()}
                  {i.resolvedAt ? ` · resolved ${new Date(i.resolvedAt).toLocaleString()}` : ''}
                </p>
                {i.resolution ? <p className="mt-1 text-xs italic text-success">Resolution: {i.resolution}</p> : null}
              </div>
              {!i.resolvedAt ? (
                <button
                  type="button" onClick={() => resolve(i.id)}
                  className="shrink-0 rounded-md border border-foreground/15 px-3 py-1 text-xs font-medium text-foreground hover:bg-foreground/5"
                >
                  Resolve
                </button>
              ) : (
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-success">Resolved</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
