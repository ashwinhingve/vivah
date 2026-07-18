import { cookies } from 'next/headers';
import type { LoanOffer } from '@smartshaadi/types';
import { LendingClient } from './LendingClient.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const LENDING_LIVE = process.env['NEXT_PUBLIC_LENDING_LIVE'] === 'true';

interface OffersResponse {
  isLsp: boolean;
  offers: LoanOffer[];
  mock: boolean;
}

async function fetchOffers(): Promise<OffersResponse> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/lending/offers?context=BOOKING`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { isLsp: true, offers: [], mock: true };
    const json = (await res.json()) as { data?: OffersResponse };
    return json.data ?? { isLsp: true, offers: [], mock: true };
  } catch {
    return { isLsp: true, offers: [], mock: true };
  }
}

export const dynamic = 'force-dynamic';

export default async function LendingPage() {
  const { offers, mock } = await fetchOffers();
  // Not-live whenever the server is mocking OR the web build hasn't flipped live.
  const isPreview = mock || !LENDING_LIVE;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold text-primary mb-2">
            Wedding financing
          </h1>
          <p className="text-muted">
            Compare loan offers from RBI-regulated lenders for your wedding plans.
          </p>
        </div>
        <LendingClient initialOffers={offers} isPreview={isPreview} />
      </div>
    </div>
  );
}
