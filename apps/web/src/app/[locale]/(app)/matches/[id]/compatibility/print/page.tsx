/**
 * Guna Milan Compatibility Report — Printable Page
 * Server Component — print-friendly, shareable Vedic compatibility analysis.
 */
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import type { GunaResult, DoshaSeverity } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

/**
 * The document title is what a browser's "Save as PDF" uses as the default
 * FILENAME. This page exists to be saved and forwarded to parents and the
 * family pandit, so inheriting the generic site title would have every one of
 * those files land as "Smart Shaadi — India's Smart Marriage Ecosystem.pdf".
 * Name it after what it actually is, in the reader's language.
 */
export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guna-milan' });
  return { title: t('documentTitle') };
}

async function fetchGuna(matchId: string): Promise<GunaResult | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/ai/guna/${matchId}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: GunaResult | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

function formatDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const SEVERITY_BADGE: Record<DoshaSeverity, string> = {
  none: '—',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export default async function GunaReportPrintPage({ params }: PageProps) {
  const { id: matchId, locale } = await params;
  const guna = await fetchGuna(matchId);
  const t = await getTranslations({ locale, namespace: 'guna-milan' });

  if (!guna) notFound();

  const doctorRecommendation = guna.blockingDosha
    ? t('doshas.blocking_description')
    : guna.recommendation;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 print:p-0 bg-background">
      <div className="mx-auto max-w-3xl">
        {/* Back link — hidden on print */}
        <div className="mb-4 print:hidden">
          <Link
            href={`/matches/${matchId}/compatibility`}
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline text-teal min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('backToCompatibility')}
          </Link>
        </div>

        {/* Report Document */}
        <div className="rounded-2xl border bg-surface shadow-sm print:shadow-none print:rounded-none border-gold">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-gold">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xl font-bold text-primary">Smart Shaadi</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('compatibilityReport')}
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-foreground">{formatDate()}</p>
              </div>
            </div>
          </div>

          {/* Score Section */}
          <div className="px-8 py-6 border-b border-gold">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {t('overallCompatibility')}
                </p>
                <p className="text-3xl font-bold text-primary">{guna.totalScore} / {guna.maxScore}</p>
                <p className="text-sm text-muted-foreground mt-1">{guna.percentage.toFixed(1)}% {t('scoreSuffix')}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-primary mb-2">{guna.interpretation}</p>
                <p className="text-xs text-muted-foreground">{t('vedicAnalysis')}</p>
              </div>
            </div>

            {guna.blockingDosha && (
              <div className="mt-4 rounded-lg border-l-4 border-destructive bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive mb-1">
                  ⚠ {t('doshas.blocking_warning')}
                </p>
                <p className="text-xs text-foreground">{t('doshas.blocking_description')}</p>
              </div>
            )}

            {doctorRecommendation && (
              <div className="mt-4 rounded-lg bg-gold/5 p-3 border border-gold/20">
                <p className="text-xs text-foreground font-medium mb-1">{t('recommendation')}:</p>
                <p className="text-sm text-foreground leading-relaxed">{doctorRecommendation}</p>
              </div>
            )}
          </div>

          {/* 8 Factors Table */}
          <div className="px-8 py-6 border-b border-gold overflow-x-auto">
            <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
              {t('factors.heading')}
            </h2>
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-gold/30">
                  <th className="pb-2 text-left font-semibold text-muted-foreground">Factor</th>
                  <th className="pb-2 text-center font-semibold text-muted-foreground">Score</th>
                  <th className="pb-2 text-left font-semibold text-muted-foreground">Status</th>
                  <th className="pb-2 text-left font-semibold text-muted-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {(['varna', 'vashya', 'tara', 'yoni', 'grahaMaitri', 'gana', 'bhakoot', 'nadi'] as const).map((key) => {
                  const factor = guna.factors[key];
                  if (!factor) return null;
                  return (
                    <tr key={key} className="border-b border-gold/15">
                      <td className="py-2.5 text-foreground pr-2">
                        <div className="font-medium">{factor.name}</div>
                        <div className="text-foreground/60">{factor.nameHi}</div>
                      </td>
                      <td className="py-2.5 text-center font-semibold">
                        {factor.score} / {factor.max}
                      </td>
                      <td className="py-2.5 text-foreground font-medium">
                        {factor.compatible ? '✓ Compatible' : '✗ Incompatible'}
                      </td>
                      <td className="py-2.5 text-foreground/70 max-w-sm">{factor.meaning}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Doshas Section */}
          <div className="px-8 py-6 border-b border-gold">
            <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
              {t('doshas.heading')}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {guna.doshas && [
                { key: 'manglik', label: t('doshas.manglik'), data: guna.doshas.manglik },
                { key: 'nadi', label: t('doshas.nadi'), data: guna.doshas.nadi },
                { key: 'bhakoot', label: t('doshas.bhakoot'), data: guna.doshas.bhakoot },
                { key: 'rajju', label: t('doshas.rajju'), data: guna.doshas.rajju },
                { key: 'vedha', label: t('doshas.vedha'), data: guna.doshas.vedha },
                { key: 'gana', label: t('doshas.gana'), data: guna.doshas.gana },
              ].map(({ key, label, data }) => {
                if (!data) return null;
                const isDosha = (data as { dosha?: boolean }).dosha ?? false;
                const severity = (data as { severity?: DoshaSeverity }).severity ?? 'none';
                const reason = (data as { reason?: string }).reason ?? '';

                return (
                  <div key={key} className="rounded border border-gold/20 p-2 bg-secondary/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-foreground">{label}</p>
                      <span className="text-foreground/60 text-xs font-mono">
                        {SEVERITY_BADGE[severity]}
                      </span>
                    </div>
                    <p className="text-foreground/70 text-xs">{isDosha ? 'Dosha Present' : 'No Dosha'}</p>
                    {reason && <p className="text-foreground/60 mt-1 leading-tight">{reason}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remedies Section */}
          {guna.remedies && guna.remedies.length > 0 && (
            <div className="px-8 py-6 border-b border-gold">
              <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
                {t('remedies.heading')}
              </h2>
              <div className="space-y-2">
                {guna.remedies.map((remedy, i) => (
                  <div key={i} className="rounded border border-gold/20 p-2 bg-secondary/30 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-foreground">{remedy.name}</p>
                      <span className="text-foreground/60">{SEVERITY_BADGE[remedy.severity]}</span>
                    </div>
                    <p className="text-foreground/70 mb-1">{remedy.dosha}</p>
                    <p className="text-foreground/70 leading-tight">{remedy.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="px-8 py-6 text-xs text-foreground/70 leading-relaxed">
            <p className="font-medium text-foreground mb-2">{t('disclaimer')}</p>
            <p>{t('disclaimer_text')}</p>
            <p className="mt-3 text-foreground/60 italic">
              This report is for informational and traditional guidance purposes only.
              For comprehensive astrological advice, please consult a qualified Vedic astrologer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
