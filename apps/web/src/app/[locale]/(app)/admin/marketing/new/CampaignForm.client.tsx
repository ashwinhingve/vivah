'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  MARKETING_TRIGGER_TYPES,
  MARKETING_SEGMENT_KEYS,
  MARKETING_CHANNELS,
  MARKETING_CONVERSION_GOALS,
  MARKETING_EVENT_HOOK_KEYS,
  type MarketingTriggerType,
  type MarketingChannel,
  type MarketingConversionGoal,
  type MarketingEventHookKey,
  type MarketingSegmentKey,
  type MarketingCampaign,
} from '@smartshaadi/types';

/** Template keys backed by real fallback copy in the api's templates.ts. */
const TEMPLATE_KEYS = ['welcome_series', 'winback_inactive', 'seasonal_muhurat'] as const;

// Cross-origin api base (ADR-002): cookies only travel with credentials:'include'.
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal';
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground';

export function CampaignForm() {
  const t = useTranslations('adminMarketing.form');
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<MarketingTriggerType>('SEGMENT_SWEEP');
  const [segmentKey, setSegmentKey] = useState<MarketingSegmentKey>('new_incomplete_48h');
  const [channels, setChannels] = useState<MarketingChannel[]>(['inapp']);
  const [templateKey, setTemplateKey] = useState<string>('welcome_series');
  const [conversionGoal, setConversionGoal] = useState<MarketingConversionGoal>('ANY');
  const [eventHookKey, setEventHookKey] = useState<MarketingEventHookKey>('user_registered');
  const [frequencyCap, setFrequencyCap] = useState(2);
  const [attributionDays, setAttributionDays] = useState(14);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleChannel = (ch: MarketingChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 3) { setError(t('errors.nameTooShort')); return; }
    if (channels.length === 0) { setError(t('errors.noChannel')); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        triggerType,
        segmentKey,
        channelSet: channels,
        templateKey,
        conversionGoal,
        frequencyCapPerWeek: frequencyCap,
        attributionWindowDays: attributionDays,
      };
      if (description.trim()) body['description'] = description.trim();
      if (triggerType === 'EVENT') body['eventHookKey'] = eventHookKey;

      const res = await fetch(`${API_BASE}/api/v1/admin/marketing`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; data?: MarketingCampaign; error?: { message?: string } };
      if (!res.ok || !json.success || !json.data) {
        setError(json.error?.message ?? t('errors.createFailed'));
        return;
      }
      router.push(`/admin/marketing/${json.data.id}`);
    } catch {
      setError(t('errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-surface p-4 shadow-card sm:p-6">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="cf-name" className={labelCls}>{t('name')}</label>
        <input
          id="cf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          required
          className={inputCls}
          placeholder={t('namePlaceholder')}
        />
      </div>

      <div>
        <label htmlFor="cf-desc" className={labelCls}>{t('description')}</label>
        <textarea
          id="cf-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-trigger" className={labelCls}>{t('triggerType')}</label>
          <select
            id="cf-trigger"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as MarketingTriggerType)}
            className={inputCls}
          >
            {MARKETING_TRIGGER_TYPES.map((tt) => (
              <option key={tt} value={tt}>{t(`triggers.${tt}`)}</option>
            ))}
          </select>
        </div>

        {triggerType === 'EVENT' ? (
          <div>
            <label htmlFor="cf-hook" className={labelCls}>{t('eventHook')}</label>
            <select
              id="cf-hook"
              value={eventHookKey}
              onChange={(e) => setEventHookKey(e.target.value as MarketingEventHookKey)}
              className={inputCls}
            >
              {MARKETING_EVENT_HOOK_KEYS.map((k) => (
                <option key={k} value={k}>{t(`hooks.${k}`)}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="cf-segment" className={labelCls}>{t('segment')}</label>
            <select
              id="cf-segment"
              value={segmentKey}
              onChange={(e) => setSegmentKey(e.target.value as MarketingSegmentKey)}
              className={inputCls}
            >
              {MARKETING_SEGMENT_KEYS.map((k) => (
                <option key={k} value={k}>{t(`segments.${k}`)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <fieldset>
        <legend className={labelCls}>{t('channels')}</legend>
        <div className="flex flex-wrap gap-2">
          {MARKETING_CHANNELS.map((ch) => (
            <label
              key={ch}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                channels.includes(ch)
                  ? 'border-teal bg-teal/10 text-teal'
                  : 'border-border bg-surface text-muted-foreground'
              }`}
            >
              <input
                type="checkbox"
                checked={channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
                className="sr-only"
              />
              {t(`channelNames.${ch}`)}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t('channelsHint')}</p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-template" className={labelCls}>{t('templateKey')}</label>
          <select
            id="cf-template"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            className={inputCls}
          >
            {TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>{t(`templates.${k}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cf-goal" className={labelCls}>{t('conversionGoal')}</label>
          <select
            id="cf-goal"
            value={conversionGoal}
            onChange={(e) => setConversionGoal(e.target.value as MarketingConversionGoal)}
            className={inputCls}
          >
            {MARKETING_CONVERSION_GOALS.map((g) => (
              <option key={g} value={g}>{t(`goals.${g}`)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-cap" className={labelCls}>{t('frequencyCap')}</label>
          <input
            id="cf-cap"
            type="number"
            min={0}
            max={14}
            value={frequencyCap}
            onChange={(e) => setFrequencyCap(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="cf-window" className={labelCls}>{t('attributionWindow')}</label>
          <input
            id="cf-window"
            type="number"
            min={1}
            max={90}
            value={attributionDays}
            onChange={(e) => setAttributionDays(Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? t('creating') : t('create')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/marketing')}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-6 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
