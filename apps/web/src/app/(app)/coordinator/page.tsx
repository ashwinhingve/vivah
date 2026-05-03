import Link from 'next/link';
import { fetchManagedWeddings } from '@/lib/wedding-api';
import { EmptyState } from '@/components/shared/EmptyState';
import { CalendarCheck } from 'lucide-react';

export const metadata = { title: 'Coordinator Dashboard' };

export default async function CoordinatorDashboardPage() {
  const data = await fetchManagedWeddings();
  const weddings = data?.weddings ?? [];

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-foreground">Coordinator dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weddings assigned to you. Click any to manage day-of operations.
          </p>
        </div>
        <span className="rounded-full bg-foreground/5 px-3 py-1 text-xs text-foreground">
          {weddings.length} active
        </span>
      </header>

      {weddings.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No weddings assigned yet"
          description="When a couple assigns you as a coordinator, the wedding will appear here with countdown, next ceremony, and outstanding tasks."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {weddings.map((w) => {
            const accent = w.daysUntil !== null && w.daysUntil <= 7 ? 'border-warning/40 bg-warning/10' : 'border-foreground/10 bg-surface';
            return (
              <li key={w.weddingId}>
                <Link
                  href={`/weddings/${w.weddingId}/day-of`}
                  className={`block rounded-xl border ${accent} p-5 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-foreground/20`}
                >
                  <div className="flex items-start justify-between">
                    <h2 className="font-heading text-lg text-foreground">{w.title}</h2>
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">{w.scope}</span>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <dt>Wedding date</dt>
                      <dd className="font-medium text-foreground">
                        {w.weddingDate ?? 'TBD'}
                        {w.daysUntil !== null ? ` · ${w.daysUntil}d` : ''}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Next ceremony</dt>
                      <dd className="font-medium text-foreground">
                        {w.nextCeremony ? `${w.nextCeremony.type}` : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Open tasks</dt>
                      <dd className="font-medium text-foreground">{w.openTasks}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Open incidents</dt>
                      <dd className={`font-medium ${w.openIncidents > 0 ? 'text-warning' : 'text-foreground'}`}>
                        {w.openIncidents}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Ceremonies</dt>
                      <dd className="font-medium text-foreground">{w.ceremoniesCount}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
