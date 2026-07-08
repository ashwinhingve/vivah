'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Package as PackageIcon } from 'lucide-react';
import { addPackageAction, removePackageAction } from '@/app/[locale]/(app)/vendor/onboarding/portfolio/packageActions';

export interface VendorPackageView {
  name?: string | null;
  price?: number | null;
  priceUnit?: string | null;
  inclusions?: string[] | null;
}

const PRICE_UNITS = ['PER_EVENT', 'PER_DAY', 'PER_HOUR', 'PER_PLATE', 'PER_PERSON', 'FIXED'];

function unitLabel(u: string): string {
  return u.replace(/_/g, ' ').toLowerCase();
}

export function PackageManager({ vendorId, initial }: { vendorId: string; initial: VendorPackageView[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(initial.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(formData: FormData) {
    const name = String(formData.get('name') ?? '').trim();
    const price = Number(formData.get('price') ?? '');
    const priceUnit = String(formData.get('priceUnit') ?? 'PER_EVENT');
    const inclusions = String(formData.get('inclusions') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    setError(null);
    startTransition(async () => {
      const r = await addPackageAction(vendorId, { name, price, priceUnit, inclusions });
      if (!r.ok) { setError(r.error); return; }
      setShowForm(false);
      router.refresh();
    });
  }

  function remove(idx: number) {
    setError(null);
    startTransition(async () => {
      const r = await removePackageAction(vendorId, idx);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  }

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';

  return (
    <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <PackageIcon className="h-4 w-4 text-teal" />
        <h3 className="font-heading text-base text-primary">Packages</h3>
        <span className="text-xs text-text-muted">— what couples can book</span>
      </div>

      {initial.length > 0 && (
        <ul className="mb-4 space-y-2">
          {initial.map((p, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">{p.name ?? 'Package'}</p>
                <p className="text-xs text-text-muted">
                  {p.price != null ? `₹${p.price.toLocaleString('en-IN')}` : '—'}
                  {p.priceUnit ? ` / ${unitLabel(p.priceUnit)}` : ''}
                  {p.inclusions && p.inclusions.length > 0 ? ` · ${p.inclusions.length} inclusion${p.inclusions.length === 1 ? '' : 's'}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(i)}
                aria-label={`Remove ${p.name ?? 'package'}`}
                className="rounded-lg p-1.5 text-text-muted hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form action={add} className="space-y-3 rounded-lg border border-gold/20 bg-background p-3">
          <input name="name" placeholder="Package name (e.g. Silver Wedding Package)" required disabled={pending} className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input name="price" type="number" min="0" placeholder="Price (₹)" required disabled={pending} className={inputCls} />
            <select name="priceUnit" defaultValue="PER_EVENT" disabled={pending} className={inputCls}>
              {PRICE_UNITS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
            </select>
          </div>
          <textarea name="inclusions" rows={3} placeholder="Inclusions — one per line" disabled={pending}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {pending ? 'Saving…' : 'Add package'}
            </button>
            {initial.length > 0 && (
              <button type="button" disabled={pending} onClick={() => { setShowForm(false); setError(null); }}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm text-text-muted hover:border-gold/40">
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/5 px-4 text-sm font-medium text-teal hover:bg-teal/10">
          <Plus className="h-4 w-4" /> Add a package
        </button>
      )}
      {error && !showForm && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
