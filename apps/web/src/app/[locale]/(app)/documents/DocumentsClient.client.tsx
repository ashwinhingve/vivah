'use client';

import { useState } from 'react';
import {
  sendForSignatureAction,
  completeSignatureAction,
  downloadPdfAction,
} from './actions';

interface Contract {
  id: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID';
  provider: 'DIGILOCKER' | 'SIGNZY' | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

interface DocumentsClientProps {
  initialContracts: Contract[];
  isMockEsign: boolean;
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'SENT':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'SIGNED':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'VOID':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export function DocumentsClient({ initialContracts, isMockEsign }: DocumentsClientProps) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendForSignature = async (contractId: string) => {
    setLoading(contractId);
    setError(null);

    try {
      const result = await sendForSignatureAction(contractId, 'DIGILOCKER');

      if (result.success && result.signingUrl) {
        // Update contract status locally
        setContracts(
          contracts.map(c =>
            c.id === contractId ? { ...c, status: 'SENT' as const, sentAt: new Date().toISOString() } : c,
          ),
        );

        // Open signing URL
        window.open(result.signingUrl, '_blank');
      } else {
        setError(result.error ?? 'Failed to send for signature');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const handleCompleteSignature = async (contractId: string) => {
    setLoading(contractId);
    setError(null);

    try {
      const result = await completeSignatureAction(contractId);

      if (result.success) {
        // Update contract status locally
        setContracts(
          contracts.map(c =>
            c.id === contractId ? { ...c, status: 'SIGNED' as const, signedAt: new Date().toISOString() } : c,
          ),
        );
      } else {
        setError(result.error ?? 'Failed to complete signature');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadPdf = async (contractId: string) => {
    setLoading(contractId);
    setError(null);

    try {
      await downloadPdfAction(contractId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download PDF');
    } finally {
      setLoading(null);
    }
  };

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center">
          <h3 className="font-heading text-xl font-semibold text-primary mb-2">
            No Documents Yet
          </h3>
          <p className="text-muted mb-4">
            Start by creating your first contract or document.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isMockEsign && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          ⚠️ E-signature is currently in mock mode and not live.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      <div className="space-y-3">
        {contracts.map(contract => (
          <div
            key={contract.id}
            className="bg-white border border-gold/20 rounded-2xl p-4 sm:p-6 shadow-card"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-lg font-semibold text-primary truncate">
                  {contract.title}
                </h3>
                <p className="text-sm text-muted mt-1">
                  Created: {new Date(contract.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className={`inline-flex px-3 py-1 rounded-full border text-sm font-medium whitespace-nowrap ${getStatusBadgeColor(contract.status)}`}>
                {contract.status}
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {contract.status === 'DRAFT' && (
                <button
                  onClick={() => handleSendForSignature(contract.id)}
                  disabled={loading === contract.id}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition text-sm font-medium"
                >
                  {loading === contract.id ? 'Sending...' : 'Send for Signature'}
                </button>
              )}

              {contract.status === 'SENT' && isMockEsign && (
                <button
                  onClick={() => handleCompleteSignature(contract.id)}
                  disabled={loading === contract.id}
                  className="flex-1 px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50 transition text-sm font-medium"
                >
                  {loading === contract.id ? 'Completing...' : 'Mock Complete Signature'}
                </button>
              )}

              {contract.status === 'SIGNED' && (
                <button
                  onClick={() => handleDownloadPdf(contract.id)}
                  disabled={loading === contract.id}
                  className="flex-1 px-4 py-2 bg-gold text-primary rounded-lg hover:bg-gold/90 disabled:opacity-50 transition text-sm font-medium"
                >
                  {loading === contract.id ? 'Downloading...' : 'Download PDF'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
