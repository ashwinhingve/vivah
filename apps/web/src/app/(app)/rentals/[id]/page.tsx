/**
 * Rental item detail page — Server Component
 *
 * Shows item details + BookingForm client component
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchAuth } from '@/lib/server-fetch';
import { BookingForm } from '@/components/rental/BookingForm.client';
import type { RentalItem } from '@smartshaadi/types';

const CATEGORY_LABELS: Record<string, string> = {
  DECOR:        'Decor',
  COSTUME:      'Costume',
  AV_EQUIPMENT: 'AV Equipment',
  FURNITURE:    'Furniture',
  LIGHTING:     'Lighting',
  TABLEWARE:    'Tableware',
  OTHER:        'Other',
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style:    'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchAuth<RentalItem>(`/api/v1/rentals/${id}`);
  return {
    title:       item ? `${item.name} — Rent — Smart Shaadi` : 'Rental Item',
    description: item?.description ?? 'Rental item details and booking',
  };
}

export default async function RentalDetailPage({ params }: Props) {
  const { id } = await params;
  const item   = await fetchAuth<RentalItem>(`/api/v1/rentals/${id}`);

  if (!item) notFound();

  const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category;
  const isLimited     = item.stockQty <= 3;

  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Thumbnail */}
        <div className="w-full aspect-[16/9] rounded-xl bg-[#C5A47E]/20 overflow-hidden flex items-center justify-center">
          {item.imageKeys[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media/${item.imageKeys[0]}`}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[#C5A47E] text-sm font-medium">No image yet</span>
          )}
        </div>

        {/* Details card */}
        <div className="rounded-xl shadow-sm bg-white p-5 space-y-4">
          {/* Category badge */}
          <span className="inline-flex rounded-full bg-[#C5A47E]/20 text-[#7B2D42] px-3 py-1 text-xs uppercase font-medium tracking-wide">
            {categoryLabel}
          </span>

          {/* Name */}
          <h1 className="text-2xl font-bold text-[#7B2D42] leading-snug">
            {item.name}
          </h1>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-[#64748B] leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Pricing */}
          <div className="flex items-baseline gap-4 flex-wrap">
            <div>
              <span className="text-xl font-bold text-[#0F172A]">
                {inrFormatter.format(item.pricePerDay)}
              </span>
              <span className="text-sm text-[#64748B]"> / day</span>
            </div>
            {item.deposit > 0 && (
              <div className="text-sm text-[#64748B]">
                Deposit: <span className="font-medium text-[#0F172A]">{inrFormatter.format(item.deposit)}</span>
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-[#FEFAF6]">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isLimited ? 'bg-amber-500' : 'bg-[#0E7C7B]'}`}
              aria-hidden="true"
            />
            <span className={`text-sm font-medium ${isLimited ? 'text-amber-700' : 'text-[#0E7C7B]'}`}>
              {isLimited
                ? `Only ${item.stockQty} unit${item.stockQty === 1 ? '' : 's'} left`
                : `${item.stockQty} units available`}
            </span>
          </div>
        </div>

        {/* Booking form */}
        <div className="rounded-xl shadow-sm bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold text-[#0A1F4D]">Book this item</h2>
          <BookingForm item={item} />
        </div>

        {/* Back link */}
        <a
          href="/rentals"
          className="block text-center text-sm text-[#64748B] hover:text-[#7B2D42] transition-colors"
        >
          ← Back to catalogue
        </a>
      </div>
    </div>
  );
}
