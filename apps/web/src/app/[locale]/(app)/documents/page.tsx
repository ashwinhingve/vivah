import { cookies } from 'next/headers';
import { DocumentsClient } from './DocumentsClient.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const ESIGN_LIVE = process.env['NEXT_PUBLIC_ESIGN_LIVE'] === 'true';

interface Contract {
  id: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID';
  provider: 'DIGILOCKER' | 'SIGNZY' | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

async function fetchContracts(): Promise<Contract[]> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/documents`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data?: { contracts?: Contract[] } };
    return json.data?.contracts ?? [];
  } catch {
    return [];
  }
}

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const contracts = await fetchContracts();
  const isMockEsign = !ESIGN_LIVE;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-primary mb-2">
            Documents & Contracts
          </h1>
          <p className="text-muted">
            Manage your legal agreements and contracts in one place.
          </p>
        </div>

        {/* Content */}
        <DocumentsClient initialContracts={contracts} isMockEsign={isMockEsign} />
      </div>
    </div>
  );
}
