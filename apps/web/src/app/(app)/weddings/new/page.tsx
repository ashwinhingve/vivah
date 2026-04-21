'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface CreateWeddingResponse {
  success: boolean;
  data?: { id: string };
  error?: string;
}

export default function NewWeddingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    weddingDate: '',
    venueName: '',
    venueCity: '',
    budgetTotal: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {};
        if (form.weddingDate) body['weddingDate'] = form.weddingDate;
        if (form.venueName)   body['venueName']   = form.venueName;
        if (form.venueCity)   body['venueCity']   = form.venueCity;
        if (form.budgetTotal) body['budgetTotal'] = parseFloat(form.budgetTotal);

        const res = await fetch(`${API_URL}/api/v1/weddings`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
          credentials: 'include',
        });

        const json = (await res.json()) as CreateWeddingResponse;

        if (!json.success || !json.data?.id) {
          setError(json.error ?? 'Could not create wedding. Please try again.');
          return;
        }

        router.push(`/weddings/${json.data.id}`);
      } catch {
        setError('Network error. Please check your connection and try again.');
      }
    });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-24">
        {/* Back link */}
        <Link
          href="/weddings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Weddings
        </Link>

        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-6">
          <h1 className="font-heading text-2xl text-[#7B2D42] mb-1">Plan Your Wedding</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Fill in the basics — you can update everything later.
          </p>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="weddingDate" className="block text-sm font-medium text-foreground mb-1.5">
                Wedding Date
              </label>
              <input
                id="weddingDate"
                name="weddingDate"
                type="date"
                value={form.weddingDate}
                onChange={handleChange}
                className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2.5 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="venueName" className="block text-sm font-medium text-foreground mb-1.5">
                Venue Name
              </label>
              <input
                id="venueName"
                name="venueName"
                type="text"
                placeholder="e.g. The Grand Palace Banquet"
                value={form.venueName}
                onChange={handleChange}
                className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2.5 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="venueCity" className="block text-sm font-medium text-foreground mb-1.5">
                City
              </label>
              <input
                id="venueCity"
                name="venueCity"
                type="text"
                placeholder="e.g. Mumbai"
                value={form.venueCity}
                onChange={handleChange}
                className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2.5 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="budgetTotal" className="block text-sm font-medium text-foreground mb-1.5">
                Total Budget (₹)
              </label>
              <input
                id="budgetTotal"
                name="budgetTotal"
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 2000000"
                value={form.budgetTotal}
                onChange={handleChange}
                className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2.5 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full min-h-[44px] rounded-lg py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#0E7C7B' }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                'Create Wedding Plan'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
