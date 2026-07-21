'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StaggerList } from '@/components/motion/StaggerList.client';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
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

const STATUS_TONE_MAP: Record<Contract['status'], StatusTone> = {
  DRAFT: 'gold',
  SENT: 'teal',
  SIGNED: 'success',
  VOID: 'error',
};

const STATUS_LABEL_KEY: Record<Contract['status'], string> = {
  DRAFT: 'statuses.draft',
  SENT: 'statuses.sent',
  SIGNED: 'statuses.signed',
  VOID: 'statuses.void',
};

export function DocumentsClient({ initialContracts, isMockEsign }: DocumentsClientProps) {
  const t = useTranslations('documents.client');
  const locale = useLocale();
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        setError(result.error ?? t('failedToSend'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failedToSend'));
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
        setError(result.error ?? t('failedToComplete'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failedToComplete'));
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
      setError(e instanceof Error ? e.message : t('failedToDownload'));
    } finally {
      setLoading(null);
    }
  };

  if (contracts.length === 0) {
    return (
      <div className="rounded-2xl border border-gold/20 bg-surface shadow-card">
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isMockEsign && (
        <div className="flex gap-3 rounded-lg border border-warning bg-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-sm text-warning">{t('mockModeWarning')}</p>
        </div>
      )}

      {error && (
        <div className="flex gap-3 rounded-lg border border-destructive bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">
            <span className="font-semibold">{t('errorPrefix')}</span> {error}
          </p>
        </div>
      )}

      <StaggerList className="space-y-3">
        {contracts.map(contract => (
          <div
            key={contract.id}
            className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6 shadow-card"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-lg font-semibold text-primary truncate">
                  {contract.title}
                </h3>
                <p className="text-sm text-muted mt-1">
                  {t('createdLabel')} {mounted ? new Date(contract.createdAt).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN') : contract.createdAt.slice(0, 10)}
                </p>
              </div>

              <StatusChip tone={STATUS_TONE_MAP[contract.status]}>
                {t(STATUS_LABEL_KEY[contract.status])}
              </StatusChip>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {contract.status === 'DRAFT' && (
                <Button
                  onClick={() => handleSendForSignature(contract.id)}
                  disabled={loading === contract.id}
                  loading={loading === contract.id}
                  className="flex-1"
                >
                  {t('sendForSignature')}
                </Button>
              )}

              {contract.status === 'SENT' && isMockEsign && (
                <Button
                  onClick={() => handleCompleteSignature(contract.id)}
                  disabled={loading === contract.id}
                  loading={loading === contract.id}
                  variant="secondary"
                  className="flex-1"
                >
                  {t('mockCompleteSignature')}
                </Button>
              )}

              {contract.status === 'SIGNED' && (
                <Button
                  onClick={() => handleDownloadPdf(contract.id)}
                  disabled={loading === contract.id}
                  loading={loading === contract.id}
                  variant="gold"
                  className="flex-1"
                >
                  {t('downloadPdf')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </StaggerList>
    </div>
  );
}
