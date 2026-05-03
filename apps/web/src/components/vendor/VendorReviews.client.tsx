'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import type { VendorReview } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface VendorReviewsProps {
  vendorId:   string;
  initial:    VendorReview[];
  total:      number;
  canReview?: boolean;
  bookingId?: string;
}

function StarsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`h-6 w-6 ${n <= value ? 'fill-amber-400 text-warning/80' : 'text-border'}`}
          />
        </button>
      ))}
    </div>
  );
}

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= rating ? 'fill-amber-400 text-warning/80' : 'text-border'}`}
        />
      ))}
    </div>
  );
}

export function VendorReviews({ vendorId, initial, total, canReview, bookingId }: VendorReviewsProps) {
  const [reviews, setReviews] = useState<VendorReview[]>(initial);
  const [open, setOpen]       = useState(false);
  const [rating, setRating]   = useState(5);
  const [title, setTitle]     = useState('');
  const [comment, setComment] = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/${vendorId}/reviews`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            rating,
            title:   title.trim() || null,
            comment: comment.trim() || null,
            ...(bookingId ? { bookingId } : {}),
          }),
        });
        const json = await res.json() as { success: boolean; data?: { review: VendorReview }; error?: { message?: string } };
        if (!res.ok || !json.success) {
          setError(json.error?.message ?? 'Failed to submit review');
          return;
        }
        if (json.data?.review) {
          setReviews((prev) => [json.data!.review, ...prev]);
        }
        setOpen(false);
        setTitle('');
        setComment('');
        setRating(5);
      } catch {
        setError('Network error');
      }
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold font-heading text-primary">
          Reviews <span className="text-muted-foreground text-sm font-normal">({total})</span>
        </h2>
        {canReview && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-medium px-3 py-1.5 min-h-[36px]"
          >
            {open ? 'Cancel' : 'Write a review'}
          </button>
        )}
      </div>

      {open && canReview && (
        <form onSubmit={submit} className="rounded-xl border border-gold/30 bg-surface p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rating</label>
            <StarsInput value={rating} onChange={setRating} />
          </div>
          <div>
            <label htmlFor="rev-title" className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <input
              id="rev-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Quick summary"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <div>
            <label htmlFor="rev-comment" className="block text-xs font-medium text-muted-foreground mb-1">Your review</label>
            <textarea
              id="rev-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Share your experience…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2 min-h-[40px] disabled:opacity-60"
          >
            {pending ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      )}

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/30 bg-surface p-8 text-center text-sm text-muted-foreground">
          No reviews yet. Be the first to share your experience.
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-gold/30 bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{r.reviewerName}</span>
                    <StarsDisplay rating={r.rating} />
                  </div>
                  {r.title && <p className="text-sm font-medium text-foreground mt-1">{r.title}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
              </div>
              {r.comment && (
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{r.comment}</p>
              )}
              {r.vendorReply && (
                <div className="mt-3 rounded-lg bg-teal/5 border border-teal/20 px-3 py-2">
                  <p className="text-xs font-semibold text-teal mb-0.5">Vendor reply</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{r.vendorReply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
