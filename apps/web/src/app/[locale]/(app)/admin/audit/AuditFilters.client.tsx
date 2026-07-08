'use client';
/**
 * AuditFilters — small controlled filter bar for the audit log. Pushes a new
 * URL with the chosen query params; the server component re-fetches on nav.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

// Mirrors auditEventTypeEnum in packages/db/schema/index.ts. Kept as a plain
// list here (web has no dependency on the db package) — add new event types
// to both places when the enum grows.
const EVENT_TYPES = [
  'USER_REGISTERED', 'USER_VERIFIED', 'USER_SUSPENDED',
  'KYC_SUBMITTED', 'KYC_VERIFIED', 'KYC_REJECTED',
  'MATCH_ACCEPTED',
  'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REFUND_ISSUED',
  'ESCROW_HELD', 'ESCROW_RELEASED', 'ESCROW_DISPUTED',
  'DISPUTE_RAISED', 'DISPUTE_RESOLVED_RELEASE', 'DISPUTE_RESOLVED_REFUND', 'DISPUTE_RESOLVED_SPLIT',
  'CONTRACT_SIGNED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED',
  'VENDOR_SUBMITTED', 'VENDOR_UNDER_REVIEW', 'VENDOR_APPROVED', 'VENDOR_REJECTED', 'VENDOR_SUSPENDED', 'VENDOR_REINSTATED',
  'PROFILE_BLOCKED', 'PROFILE_REPORTED',
  'INVOICE_GENERATED', 'INVOICE_CANCELLED',
  'WALLET_CREDIT', 'WALLET_DEBIT', 'PROMO_REDEEMED',
  'PAYOUT_INITIATED', 'PAYOUT_COMPLETED', 'PAYOUT_FAILED',
  'REFUND_REQUESTED', 'REFUND_APPROVED', 'REFUND_REJECTED',
  'PAYMENT_LINK_CREATED', 'PAYMENT_LINK_PAID',
  'WEBHOOK_RECEIVED', 'WEBHOOK_DUPLICATE',
  'PLATFORM_SETTING_CHANGED',
] as const;

interface Props {
  initialEventType: string;
  initialEntityType: string;
  initialEntityId: string;
  initialActorId: string;
  initialFrom: string;
  initialTo: string;
}

export function AuditFilters({ initialEventType, initialEntityType, initialEntityId, initialActorId, initialFrom, initialTo }: Props) {
  const t = useTranslations('adminRole');
  const router = useRouter();
  const [eventType, setEventType] = useState(initialEventType);
  const [entityType, setEntityType] = useState(initialEntityType);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [actorId, setActorId] = useState(initialActorId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function apply() {
    const params = new URLSearchParams();
    if (eventType)  params.set('eventType', eventType);
    if (entityType) params.set('entityType', entityType);
    if (entityId)   params.set('entityId', entityId.trim());
    if (actorId)    params.set('actorId', actorId.trim());
    if (from)       params.set('from', from);
    if (to)         params.set('to', to);
    router.push(`/admin/audit${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function clear() {
    setEventType('');
    setEntityType('');
    setEntityId('');
    setActorId('');
    setFrom('');
    setTo('');
    router.push('/admin/audit');
  }

  const hasFilters = Boolean(initialEventType || initialEntityType || initialEntityId || initialActorId || initialFrom || initialTo);

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('audit.filters.eventType')}</span>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          >
            <option value="">{t('audit.filters.allEvents')}</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('audit.filters.entityType')}</span>
          <input
            type="text"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder={t('audit.filters.entityTypePlaceholder')}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('audit.filters.actorId')}</span>
          <input
            type="text"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            placeholder={t('audit.filters.actorIdPlaceholder')}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('audit.filters.entityId')}</span>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder={t('audit.filters.entityIdPlaceholder')}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('audit.filters.from')}</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('audit.filters.to')}</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={apply}
          className="flex h-10 items-center justify-center rounded-lg bg-teal px-4 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover"
        >
          {t('common.applyFilters')}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="flex h-10 items-center justify-center rounded-lg border border-gold/30 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {t('common.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
