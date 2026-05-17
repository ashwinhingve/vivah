'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Check, X } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface VendorHit {
  id: string;
  businessName: string;
  city?: string | null;
}

/**
 * Searchable vendor selector. Calls GET /api/v1/vendors?q= and writes the
 * chosen vendor's id into a hidden input named "vendorId" so it submits with
 * the surrounding server-action form.
 */
export function VendorPicker() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VendorHit[]>([]);
  const [selected, setSelected] = useState<VendorHit | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/v1/vendors?q=${encodeURIComponent(query.trim())}&limit=8`,
          { cache: 'no-store' },
        );
        const json = (await res.json()) as {
          success: boolean;
          data?: { vendors: VendorHit[] };
        };
        setHits(json.success ? json.data?.vendors ?? [] : []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, selected]);

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor *</label>
      <input type="hidden" name="vendorId" value={selected?.id ?? ''} />

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-teal/40 bg-teal/5 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5 text-foreground">
            <Check className="h-4 w-4 text-teal" aria-hidden="true" />
            {selected.businessName}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery('');
            }}
            aria-label="Clear selected vendor"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors by name…"
            className="w-full min-h-[40px] rounded-lg border border-gold/30 pl-9 pr-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
          />
          {(loading || hits.length > 0) && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-gold/30 bg-surface shadow-lg max-h-56 overflow-y-auto">
              {loading && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
              )}
              {!loading &&
                hits.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelected(v);
                      setHits([]);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-background transition-colors"
                  >
                    <span className="text-foreground">{v.businessName}</span>
                    {v.city && <span className="text-muted-foreground"> · {v.city}</span>}
                  </button>
                ))}
              {!loading && hits.length === 0 && query.trim().length >= 2 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No vendors found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
