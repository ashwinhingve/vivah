'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ImageIcon, X } from 'lucide-react';
import { addPortfolioItemAction, removePortfolioItemAction } from '@/app/[locale]/(app)/vendor/onboarding/portfolio/itemActions';
import { R2Uploader } from '@/components/wedding/R2Uploader.client';
import { resolvePhotoUrl } from '@/lib/photo';
import { EVENT_TYPE_VALUES } from '@smartshaadi/schemas';

export interface VendorPortfolioItemView {
  title?: string | null;
  description?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  photoKeys?: string[] | null;
}

function label(v: string): string {
  return v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PortfolioItemManager({ vendorId, initial }: { vendorId: string; initial: VendorPortfolioItemView[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(initial.length === 0);
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(formData: FormData) {
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const eventType = String(formData.get('eventType') ?? '').trim();
    const eventDate = String(formData.get('eventDate') ?? '').trim();
    setError(null);
    startTransition(async () => {
      const r = await addPortfolioItemAction(vendorId, {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(eventType ? { eventType } : {}),
        ...(eventDate ? { eventDate } : {}),
        ...(photoKeys.length ? { photoKeys } : {}),
      });
      if (!r.ok) { setError(r.error); return; }
      setShowForm(false);
      setPhotoKeys([]);
      router.refresh();
    });
  }

  function remove(idx: number) {
    setError(null);
    startTransition(async () => {
      const r = await removePortfolioItemAction(vendorId, idx);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  }

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';

  return (
    <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-teal" />
        <h3 className="font-heading text-base text-primary">Work samples</h3>
        <span className="text-xs text-text-muted">— show couples what you&apos;ve delivered</span>
      </div>

      {initial.length > 0 && (
        <ul className="mb-4 space-y-2">
          {initial.map((item, i) => {
            const thumbs = (item.photoKeys ?? [])
              .slice(0, 4)
              .map((k) => resolvePhotoUrl(k))
              .filter((u): u is string => u !== null);
            return (
              <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                <div className="flex min-w-0 gap-3">
                  {thumbs.length > 0 && (
                    <div className="flex shrink-0 -space-x-2">
                      {thumbs.map((url, ti) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={ti}
                          src={url}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 rounded-lg border-2 border-surface object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">{item.title ?? 'Work sample'}</p>
                    <p className="text-xs text-text-muted">
                      {item.eventType ? label(item.eventType) : ''}
                      {item.eventType && item.eventDate ? ' · ' : ''}
                      {item.eventDate ? formatDate(item.eventDate) : ''}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">{item.description}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(i)}
                  aria-label={`Remove ${item.title ?? 'work sample'}`}
                  className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <form action={add} className="space-y-3 rounded-lg border border-gold/20 bg-background p-3">
          <input name="title" placeholder="Title (e.g. Riya & Kabir's Sangeet)" disabled={pending} className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <select name="eventType" defaultValue="" disabled={pending} className={inputCls}>
              <option value="">Event type</option>
              {EVENT_TYPE_VALUES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
            </select>
            <input name="eventDate" type="date" disabled={pending} className={inputCls} />
          </div>
          <textarea name="description" rows={2} placeholder="What made this event special?" disabled={pending}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />

          <div>
            {photoKeys.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {photoKeys.map((key, i) => {
                  const url = resolvePhotoUrl(key);
                  return (
                    <div key={key} className="relative h-14 w-14 overflow-hidden rounded-lg border border-border">
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setPhotoKeys((prev) => prev.filter((_, pi) => pi !== i))}
                        aria-label="Remove photo"
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <R2Uploader
              folder="portfolios"
              label="Add photo"
              onUploaded={(r2Key) => setPhotoKeys((prev) => (prev.length >= 20 ? prev : [...prev, r2Key]))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {pending ? 'Saving…' : 'Add work sample'}
            </button>
            {initial.length > 0 && (
              <button type="button" disabled={pending}
                onClick={() => { setShowForm(false); setError(null); setPhotoKeys([]); }}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm text-text-muted hover:border-gold/40">
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/5 px-4 text-sm font-medium text-teal hover:bg-teal/10">
          <Plus className="h-4 w-4" /> Add a work sample
        </button>
      )}
      {error && !showForm && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
