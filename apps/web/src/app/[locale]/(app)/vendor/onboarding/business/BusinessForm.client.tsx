'use client';

import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { saveBusinessAction } from './actions';
import type { VendorProfile } from '@smartshaadi/types';

const CATEGORIES = [
  'PHOTOGRAPHY', 'VIDEOGRAPHY', 'CATERING', 'DECORATION', 'VENUE',
  'MAKEUP', 'JEWELLERY', 'CLOTHING', 'MUSIC', 'LIGHTING', 'SECURITY',
  'TRANSPORT', 'PRIEST', 'SOUND', 'EVENT_HOSTING', 'RENTAL', 'OTHER',
] as const;

function label(c: string): string {
  return c.charAt(0) + c.slice(1).toLowerCase().replace('_', ' ');
}

export function BusinessForm({ vendor }: { vendor: VendorProfile | null }) {
  const [state, formAction, pending] = useActionState(saveBusinessAction, undefined);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';
  const labelCls = 'mb-1 block text-sm font-medium text-primary';

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      {vendor?.id && <input type="hidden" name="vendorId" value={vendor.id} />}

      <div>
        <label htmlFor="businessName" className={labelCls}>Business name *</label>
        <input id="businessName" name="businessName" required defaultValue={vendor?.businessName ?? ''} disabled={pending} className={inputCls} />
      </div>

      <div>
        <label htmlFor="category" className={labelCls}>Category *</label>
        <select id="category" name="category" required defaultValue={vendor?.category ?? ''} disabled={pending} className={inputCls}>
          <option value="" disabled>Select a category…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={labelCls}>City *</label>
          <input id="city" name="city" required defaultValue={vendor?.city ?? ''} disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="state" className={labelCls}>State *</label>
          <input id="state" name="state" required defaultValue={vendor?.state ?? ''} disabled={pending} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelCls}>Contact phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={vendor?.phone ?? ''} disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>Contact email</label>
          <input id="email" name="email" type="email" defaultValue={vendor?.email ?? ''} disabled={pending} className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="tagline" className={labelCls}>Tagline</label>
        <input id="tagline" name="tagline" maxLength={255} defaultValue={vendor?.tagline ?? ''} disabled={pending} className={inputCls} placeholder="One line that sums up your work" />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>About your business</label>
        <textarea id="description" name="description" rows={4} defaultValue={vendor?.description ?? ''} disabled={pending}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {pending ? 'Saving…' : 'Save & continue'} <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
