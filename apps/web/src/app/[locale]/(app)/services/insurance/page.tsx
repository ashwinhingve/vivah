import { cookies } from 'next/headers';
import type { InsuranceQuote, InsuranceSku } from '@smartshaadi/types';
import { InsuranceClient } from './InsuranceClient.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const INSURANCE_LIVE = process.env['NEXT_PUBLIC_INSURANCE_LIVE'] === 'true';

interface QuotesResponse {
  quotes: InsuranceQuote[];
  leadSku: InsuranceSku;
  mock: boolean;
}

async function fetchQuotes(): Promise<QuotesResponse> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/insurance/quotes?context=BOOKING`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { quotes: [], leadSku: 'HEALTH', mock: true };
    const json = (await res.json()) as { data?: QuotesResponse };
    return json.data ?? { quotes: [], leadSku: 'HEALTH', mock: true };
  } catch {
    return { quotes: [], leadSku: 'HEALTH', mock: true };
  }
}

export const dynamic = 'force-dynamic';

export default async function InsurancePage() {
  const { quotes, mock } = await fetchQuotes();
  const isPreview = mock || !INSURANCE_LIVE;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold text-primary mb-2">
            Insurance for your big day
          </h1>
          <p className="text-muted">
            Compare cover from IRDAI-registered insurers — health, life, travel, and
            wedding-event protection.
          </p>
        </div>
        <InsuranceClient initialQuotes={quotes} isPreview={isPreview} />
      </div>
    </div>
  );
}
