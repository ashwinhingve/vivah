'use client';

import { useEffect, useState, useTransition } from 'react';
import type { DayOfSnapshot } from '@smartshaadi/types';
import { useToast } from '@/components/ui/toast';

const POLL_MS = 15_000;

interface Props {
  weddingId: string;
  initial: DayOfSnapshot;
}

export function DayOfDashboard({ weddingId, initial }: Props) {
  const [snap, setSnap] = useState<DayOfSnapshot>(initial);
  const [, startTx] = useTransition();
  const { toast } = useToast();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/v1/weddings/${weddingId}/day-of/snapshot`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const json = await res.json();
        if (json?.success && json.data) setSnap(json.data as DayOfSnapshot);
      } catch { /* ignore poll errors */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [weddingId, apiBase]);

  const setStatus = (ceremonyId: string, status: 'IN_PROGRESS' | 'COMPLETED') => {
    startTx(async () => {
      const res = await fetch(`${apiBase}/api/v1/weddings/${weddingId}/day-of/ceremonies/${ceremonyId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json?.success) {
        toast(`Ceremony ${status}`, 'success');
        setSnap((s) => ({
          ...s,
          activeCeremonyId: status === 'IN_PROGRESS' ? ceremonyId : (s.activeCeremonyId === ceremonyId ? null : s.activeCeremonyId),
          ceremonies: s.ceremonies.map((c) => (c.id === ceremonyId ? { ...c, status } : c)),
        }));
      } else {
        toast(json?.error?.message ?? 'Could not update ceremony status', 'error');
      }
    });
  };

  const checkInVendor = (eventId: string, checkedIn: boolean) => {
    startTx(async () => {
      const res = await fetch(`${apiBase}/api/v1/weddings/${weddingId}/day-of/timeline/${eventId}/check-in`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn }),
      });
      const json = await res.json();
      if (json?.success) {
        toast(checkedIn ? 'Vendor checked in' : 'Vendor checkout', 'success');
        setSnap((s) => ({
          ...s,
          vendorCheckIns: s.vendorCheckIns.map((v) =>
            v.eventId === eventId ? { ...v, checkedIn, checkedInAt: checkedIn ? new Date().toISOString() : null } : v
          ),
        }));
      } else {
        toast(json?.error?.message ?? 'Could not toggle check-in', 'error');
      }
    });
  };

  const arrivalsPct = snap.guestArrivals.expected > 0
    ? Math.round((snap.guestArrivals.arrived / snap.guestArrivals.expected) * 100)
    : 0;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-3xl text-foreground">Live day-of dashboard</h1>
        <p className="text-xs text-muted-foreground">Updated {new Date(snap.asOf).toLocaleTimeString()}</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Ceremonies */}
        <div className="rounded-xl border border-foreground/10 bg-surface p-4 shadow-sm">
          <h2 className="font-heading text-lg text-foreground">Ceremonies</h2>
          <ul className="mt-3 space-y-3">
            {snap.ceremonies.map((c) => {
              const active = snap.activeCeremonyId === c.id;
              return (
                <li key={c.id} className={`rounded-lg border p-3 ${active ? 'border-emerald-300 bg-success/10' : 'border-foreground/10'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{c.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.date ?? 'TBD'} {c.startTime ? `· ${c.startTime}` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      c.status === 'IN_PROGRESS' ? 'bg-success text-success' :
                      c.status === 'COMPLETED'   ? 'bg-foreground/10 text-foreground' :
                      c.status === 'CANCELLED'   ? 'bg-rose-100 text-rose-800' :
                      'bg-warning/15 text-warning'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {c.status !== 'IN_PROGRESS' && c.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => setStatus(c.id, 'IN_PROGRESS')}
                        className="rounded-md bg-success px-3 py-1 text-xs font-medium text-white hover:bg-success"
                      >
                        Start
                      </button>
                    )}
                    {c.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() => setStatus(c.id, 'COMPLETED')}
                        className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Guest arrivals */}
        <div className="rounded-xl border border-foreground/10 bg-surface p-4 shadow-sm">
          <h2 className="font-heading text-lg text-foreground">Guest arrivals</h2>
          <p className="mt-3 text-4xl font-semibold text-foreground">
            {snap.guestArrivals.arrived}
            <span className="text-muted-foreground text-base"> / {snap.guestArrivals.expected}</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full bg-success transition-all" style={{ width: `${arrivalsPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{arrivalsPct}% checked in</p>
        </div>

        {/* Recent incidents */}
        <div className="rounded-xl border border-foreground/10 bg-surface p-4 shadow-sm">
          <h2 className="font-heading text-lg text-foreground">Recent incidents</h2>
          {snap.recentIncidents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No incidents reported. Smooth sailing.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {snap.recentIncidents.slice(0, 5).map((i) => (
                <li key={i.id} className="rounded-md border border-foreground/10 p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{i.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      i.severity === 'CRITICAL' ? 'bg-rose-200 text-rose-900' :
                      i.severity === 'HIGH'     ? 'bg-warning/20 text-warning' :
                      i.severity === 'MEDIUM'   ? 'bg-warning/15 text-warning' :
                      'bg-foreground/10 text-foreground'
                    }`}>
                      {i.severity}
                    </span>
                  </div>
                  {i.resolvedAt ? (
                    <p className="mt-1 text-xs text-success">Resolved</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Open</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Vendor check-ins */}
      <section className="mt-6 rounded-xl border border-foreground/10 bg-surface p-4 shadow-sm">
        <h2 className="font-heading text-lg text-foreground">Vendor check-ins</h2>
        {snap.vendorCheckIns.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No timeline events with vendors assigned.</p>
        ) : (
          <ul className="mt-3 divide-y divide-foreground/5">
            {snap.vendorCheckIns.map((v) => (
              <li key={v.eventId} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{v.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.vendorName ?? 'Vendor TBD'} · {new Date(v.startTime).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => checkInVendor(v.eventId, !v.checkedIn)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    v.checkedIn ? 'bg-success text-white hover:bg-success' : 'border border-foreground/15 text-foreground hover:bg-foreground/5'
                  }`}
                >
                  {v.checkedIn ? 'Checked in' : 'Mark arrived'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
