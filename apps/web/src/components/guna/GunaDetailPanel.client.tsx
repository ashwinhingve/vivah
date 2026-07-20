'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { GunaResult, DoshaSeverity } from '@smartshaadi/types';
import { fetchGuna } from '@/app/actions/ai';
import { GunaScoreRing } from '@/components/matching/GunaScoreRing';
import { AlertCircle, Printer } from 'lucide-react';

interface Props {
  matchId: string;
}

const SEVERITY_COLOR: Record<DoshaSeverity, { bg: string; border: string; text: string }> = {
  none: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-foreground' },
  low: { bg: 'bg-teal/10', border: 'border-teal/30', text: 'text-foreground' },
  medium: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-foreground' },
  high: { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive' },
};

function PanelSkeleton() {
  return (
    <section className="mt-8 border-t border-gold/20 pt-8" aria-busy="true">
      <div className="h-8 w-64 bg-muted/40 rounded animate-pulse mb-4" />
      <div className="space-y-6">
        <div className="h-40 bg-muted/30 rounded animate-pulse" />
        <div className="h-64 bg-muted/30 rounded animate-pulse" />
      </div>
    </section>
  );
}

function BlockingDoshaWarning({ blocking_warning, blocking_description }: { blocking_warning: string; blocking_description: string }) {
  return (
    <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 p-4 mb-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-destructive flex-none mt-0.5" />
      <div>
        <p className="font-medium text-destructive mb-1">{blocking_warning}</p>
        <p className="text-sm text-foreground">{blocking_description}</p>
      </div>
    </div>
  );
}

function FactorsTable({ factors }: { factors: GunaResult['factors'] }) {
  const factorKeys = ['varna', 'vashya', 'tara', 'yoni', 'grahaMaitri', 'gana', 'bhakoot', 'nadi'] as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-gold/30">
            <th className="pb-3 text-left text-xs font-semibold text-muted-foreground">Factor</th>
            <th className="pb-3 text-center text-xs font-semibold text-muted-foreground">Score</th>
            <th className="pb-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
            <th className="pb-3 text-left text-xs font-semibold text-muted-foreground">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {factorKeys.map((key) => {
            const factor = factors[key as keyof typeof factors];
            if (!factor) return null;
            const isCompatible = factor.compatible;
            const statusColor = isCompatible ? 'text-success' : 'text-warning';
            return (
              <tr key={key} className="border-b border-gold/15">
                <td className="py-3 text-foreground">
                  <div className="font-medium">{factor.name}</div>
                  <div className="text-xs text-muted-foreground">{factor.nameHi}</div>
                </td>
                <td className="py-3 text-center font-semibold">
                  <span className="text-lg">{factor.score}</span>
                  <span className="text-xs text-muted-foreground"> / {factor.max}</span>
                </td>
                <td className={`py-3 text-xs font-medium uppercase tracking-wide ${statusColor}`}>
                  {isCompatible ? 'Compatible' : 'Incompatible'}
                </td>
                <td className="py-3 text-xs text-muted-foreground max-w-xs">{factor.meaning}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DoshasSection({ doshas }: { doshas: GunaResult['doshas'] }) {
  const t = useTranslations('guna-milan.doshas');

  if (!doshas) return null;

  const doshaList = [
    { key: 'manglik', label: t('manglik'), data: doshas.manglik },
    { key: 'nadi', label: t('nadi'), data: doshas.nadi },
    { key: 'bhakoot', label: t('bhakoot'), data: doshas.bhakoot },
    { key: 'rajju', label: t('rajju'), data: doshas.rajju },
    { key: 'vedha', label: t('vedha'), data: doshas.vedha },
    { key: 'gana', label: t('gana'), data: doshas.gana },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">{t('heading')}</h3>
      <div className="grid gap-3">
        {doshaList.map(({ key, label, data }) => {
          if (!data) return null;
          const isDosha = (data as { dosha?: boolean }).dosha ?? false;
          const severity = (data as { severity?: DoshaSeverity }).severity ?? 'none';
          const reason = (data as { reason?: string }).reason ?? '';
          const colors = SEVERITY_COLOR[severity];

          return (
            <div
              key={key}
              className={`rounded-lg border p-3 ${colors.bg} ${colors.border} border`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-foreground">{label}</p>
                <span className={`text-xs font-medium uppercase tracking-wide px-2 py-1 rounded ${colors.text}`}>
                  {isDosha ? t('status.dosha') : t('status.no_dosha')}
                </span>
              </div>
              {reason && <p className="text-xs text-foreground leading-relaxed">{reason}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RemediesSection({ remedies }: { remedies: GunaResult['remedies'] }) {
  const t = useTranslations('guna-milan.remedies');

  if (!remedies || remedies.length === 0) {
    return (
      <div>
        <h3 className="font-semibold text-foreground mb-3">{t('heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-foreground mb-3">{t('heading')}</h3>
      <div className="space-y-3">
        {remedies.map((remedy, i) => (
          <div key={i} className="rounded-lg border border-gold/20 bg-surface p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-medium text-foreground">{remedy.name}</p>
              <span className={`text-xs font-medium uppercase tracking-wide px-2 py-1 rounded ${SEVERITY_COLOR[remedy.severity].text}`}>
                {remedy.severity}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{remedy.dosha}</p>
            <p className="text-sm text-foreground leading-relaxed">{remedy.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GunaDetailPanel({ matchId }: Props) {
  const t = useTranslations('guna-milan');
  const router = useRouter();
  const [data, setData] = useState<GunaResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchGuna(matchId).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (loading) return <PanelSkeleton />;
  if (!data) return null;

  return (
    <section className="mt-8 border-t border-gold/20 pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-heading font-bold text-primary">{t('heading')}</h2>
        <button
          onClick={() => router.push(`/matches/${matchId}/compatibility/print`)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-teal border border-teal/30 hover:bg-teal/5 transition-colors min-h-[44px]"
        >
          <Printer className="h-4 w-4" />
          {t('printReport')}
        </button>
      </div>

      {/* Score Ring */}
      <div className="flex flex-col items-center mb-8">
        <GunaScoreRing score={data.totalScore} total={data.maxScore} size={160} className="mb-4" />
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-1">
            {data.interpretation}
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            {data.percentage.toFixed(1)}% compatibility score
          </p>
        </div>
      </div>

      {/* Blocking Dosha Warning */}
      {data.blockingDosha && (
        <BlockingDoshaWarning
          blocking_warning={t('doshas.blocking_warning')}
          blocking_description={t('doshas.blocking_description')}
        />
      )}

      {/* Recommendation */}
      {data.recommendation && (
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 mb-6">
          <p className="text-sm text-foreground">{data.recommendation}</p>
        </div>
      )}

      {/* Factors Table */}
      <div className="mb-8">
        <h3 className="font-semibold text-foreground mb-4">{t('factors.heading')}</h3>
        <FactorsTable factors={data.factors} />
      </div>

      {/* Doshas */}
      <div className="mb-8">
        <DoshasSection doshas={data.doshas} />
      </div>

      {/* Remedies */}
      <div className="mb-8">
        <RemediesSection remedies={data.remedies} />
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-gold/20 bg-secondary/30 p-4 text-xs text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-2">{t('disclaimer')}</p>
        <p>{t('disclaimer_text')}</p>
      </div>
    </section>
  );
}
