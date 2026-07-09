'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { addServiceAction } from './actions';

const SERVICE_UNITS = [
  { value: 'per event', label: 'Per event' },
  { value: 'per day', label: 'Per day' },
  { value: 'per hour', label: 'Per hour' },
  { value: 'per plate', label: 'Per plate' },
  { value: 'per person', label: 'Per person' },
  { value: 'fixed', label: 'Fixed' },
];

export function AddServiceForm({ vendorId }: { vendorId: string }) {
  const [state, formAction, pending] = useActionState(addServiceAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && 'ok' in state) formRef.current?.reset();
  }, [state]);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';
  const labelCls = 'mb-1 block text-sm font-medium text-primary';

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <input type="hidden" name="vendorId" value={vendorId} />
      <h3 className="font-heading text-base text-primary">Add a service</h3>

      <div>
        <label htmlFor="name" className={labelCls}>Service name *</label>
        <input id="name" name="name" required disabled={pending} className={inputCls} placeholder="e.g. Full-day wedding photography" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="priceFrom" className={labelCls}>Price from (₹) *</label>
          <input id="priceFrom" name="priceFrom" type="number" min="1" required disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="priceTo" className={labelCls}>Up to (₹)</label>
          <input id="priceTo" name="priceTo" type="number" min="1" disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="unit" className={labelCls}>Unit *</label>
          <select id="unit" name="unit" required disabled={pending} defaultValue="per event" className={inputCls}>
            {SERVICE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Description</label>
        <textarea id="description" name="description" rows={2} disabled={pending}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />
      </div>

      {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-teal/30 bg-teal/5 px-5 text-sm font-medium text-teal hover:bg-teal/10 disabled:opacity-50">
        <Plus className="h-4 w-4" /> {pending ? 'Adding…' : 'Add service'}
      </button>
    </form>
  );
}
