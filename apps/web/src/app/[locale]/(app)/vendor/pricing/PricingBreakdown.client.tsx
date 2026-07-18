'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Sparkles, CalendarDays, TrendingUp, ShieldCheck } from 'lucide-react';
import type { WireMoney, WirePricingRule, WirePricingSuggestion } from './types';

/** Integer-paise string → "₹1,234.50" display. */
function inr(m: WireMoney): string {
  const rupees = Number(BigInt(m.paise)) / 100;
  const symbol = m.currency === 'INR' ? '₹' : `${m.currency} `;
  return `${symbol}${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Multiplier → signed percentage label, e.g. 1.25 → "+25%", 0.9 → "−10%", 1 → "—". */
function pctLabel(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 100);
  if (pct === 0) return '—';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

interface FactorRowProps {
  icon: typeof Sparkles;
  label: string;
  multiplier: number;
}

function FactorRow({ icon: Icon, label, multiplier }: FactorRowProps) {
  const active = multiplier !== 1;
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2 text-sm text-text">
        <Icon className="h-4 w-4 text-teal" aria-hidden />
        {label}
      </span>
      <span className={active ? 'text-sm font-semibold text-primary' : 'text-sm text-text-muted'}>
        {pctLabel(multiplier)}
      </span>
    </div>
  );
}

interface Props {
  rules: WirePricingRule[];
  selectedRuleId: string;
  date: string;
  suggestion: WirePricingSuggestion | null;
}

export function PricingBreakdown({ rules, selectedRuleId, date, suggestion }: Props) {
  const t = useTranslations('vendorPricing');
  const router = useRouter();

  function update(next: { ruleId?: string; date?: string }) {
    const ruleId = next.ruleId ?? selectedRuleId;
    const d = next.date ?? date;
    router.push(`/vendor/pricing?ruleId=${ruleId}&date=${d}`);
  }

  const clampHit =
    suggestion != null && suggestion.rawMultiplier !== suggestion.clampedMultiplier;
  const clampToCeiling =
    suggestion != null && suggestion.clampedMultiplier < suggestion.rawMultiplier;

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="grid gap-4 rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:grid-cols-2 sm:p-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gold-muted">
            {t('serviceLabel')}
          </span>
          <select
            value={selectedRuleId}
            onChange={(e) => update({ ruleId: e.target.value })}
            className="h-11 w-full rounded-lg border border-gold/30 bg-background px-3 text-sm text-text focus:border-teal focus:outline-none"
          >
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.serviceCategory}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gold-muted">
            {t('eventDateLabel')}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => update({ date: e.target.value })}
            className="h-11 w-full rounded-lg border border-gold/30 bg-background px-3 text-sm text-text focus:border-teal focus:outline-none"
          />
        </label>
      </div>

      {suggestion == null ? (
        <div className="rounded-2xl border border-gold/20 bg-surface p-6 text-sm text-text-muted shadow-card">
          {t('noSuggestion')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card">
          {/* Suggested price */}
          <div className="border-b border-gold/15 bg-gradient-to-br from-surface to-teal/5 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-gold-muted">
              {t('suggestedPrice')}
            </p>
            <p className="mt-1 font-heading text-4xl font-semibold text-primary">
              {inr(suggestion.suggested)}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {t('baseAndMultiplier', { base: inr(suggestion.base), multiplier: suggestion.clampedMultiplier.toFixed(3) })}
            </p>
          </div>

          {/* Applied factors */}
          <div className="divide-y divide-gold/10 px-6">
            <FactorRow icon={Sparkles} label={t('appliedFactors.muhurat')} multiplier={suggestion.appliedFactors.MUHURAT} />
            <FactorRow icon={CalendarDays} label={t('appliedFactors.offseason')} multiplier={suggestion.appliedFactors.OFFSEASON} />
            <FactorRow icon={TrendingUp} label={t('appliedFactors.demand')} multiplier={suggestion.appliedFactors.DEMAND} />
          </div>

          {/* Clamp visibility */}
          {clampHit && (
            <div className="mx-6 mb-4 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              {t('clampWarning', {
                rawMultiplier: suggestion.rawMultiplier.toFixed(3),
                action: clampToCeiling ? t('clampActionCeiling') : t('clampActionFloor')
              })}
            </div>
          )}

          {/* Explanation + override note */}
          <div className="space-y-2 border-t border-gold/15 bg-background/40 p-6">
            <p className="text-sm text-text">{suggestion.explanationEn}</p>
            <p className="text-sm text-text-muted" lang="hi">
              {suggestion.explanationHi}
            </p>
            <p className="flex items-center gap-1.5 pt-2 text-xs text-teal">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t('suggestionNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
