'use client';

/**
 * Admin package table — Phase 8, Unit 8.1.
 *
 * Two toggles per row. `isPlaceholder` is the onboarding switch: turning it off
 * is what converts seeded fictional inventory into real bookable supply, so it
 * asks for confirmation and states what it unlocks. `isActive` is ordinary
 * catalogue visibility and does not.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, EyeOff, Eye, FlaskConical, Store } from 'lucide-react';
import type { PremiumPackageWithVendor } from '@smartshaadi/types';
import { formatINRCompact } from '@/lib/format';
import { setPlaceholderAction, setActiveAction } from './actions';

export function AdminPackageTable({ packages }: { packages: PremiumPackageWithVendor[] }) {
  const t = useTranslations('adminPackages');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(id: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.success) setError(res.error ?? t('genericError'));
    });
  }

  function togglePlaceholder(pkg: PremiumPackageWithVendor) {
    // Only the promoting direction is confirmed. Marking something back as
    // placeholder removes an ability; granting one deserves the friction.
    if (pkg.isPlaceholder) {
      const ok = window.confirm(t('confirmPromote', { title: pkg.title }));
      if (!ok) return;
    }
    run(pkg.id, () => setPlaceholderAction(pkg.id, !pkg.isPlaceholder));
  }

  if (packages.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-gold/25 bg-surface p-8 text-center text-muted">
        {t('empty')}
      </p>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Horizontal scroll container so a wide table never makes the page
          itself scroll sideways on a 360px screen. */}
      <div className="overflow-x-auto rounded-2xl border border-gold/25 bg-surface shadow-card">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-gold/25 text-xs uppercase tracking-wide text-gold-muted">
            <tr>
              <th scope="col" className="px-4 py-3">{t('col.package')}</th>
              <th scope="col" className="px-4 py-3">{t('col.city')}</th>
              <th scope="col" className="px-4 py-3">{t('col.tier')}</th>
              <th scope="col" className="px-4 py-3">{t('col.price')}</th>
              <th scope="col" className="px-4 py-3">{t('col.supply')}</th>
              <th scope="col" className="px-4 py-3">{t('col.visibility')}</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => {
              const busy = isPending && busyId === pkg.id;
              return (
                <tr
                  key={pkg.id}
                  className="border-b border-gold/10 last:border-0"
                  style={{ opacity: busy ? 0.5 : 1 }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{pkg.title}</p>
                    <p className="text-xs text-muted">{pkg.vendorName}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{pkg.destinationCity}</td>
                  <td className="px-4 py-3 text-muted">{t(`tier.${pkg.tier}`)}</td>
                  <td className="px-4 py-3 text-primary">{formatINRCompact(pkg.priceFrom)}</td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => togglePlaceholder(pkg)}
                      className={[
                        'inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs transition disabled:opacity-50',
                        pkg.isPlaceholder
                          ? 'border-warning/40 bg-warning/10 text-warning'
                          : 'border-success/40 bg-success/10 text-success',
                      ].join(' ')}
                      title={pkg.isPlaceholder ? t('promoteHint') : t('demoteHint')}
                    >
                      {pkg.isPlaceholder ? (
                        <><FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />{t('supply.placeholder')}</>
                      ) : (
                        <><Store className="h-3.5 w-3.5" aria-hidden="true" />{t('supply.real')}</>
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(pkg.id, () => setActiveAction(pkg.id, !pkg.isActive))}
                      className={[
                        'inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs transition disabled:opacity-50',
                        pkg.isActive
                          ? 'border-teal/40 bg-teal/10 text-teal'
                          : 'border-gold/40 bg-background text-gold-muted',
                      ].join(' ')}
                    >
                      {pkg.isActive ? (
                        <><Eye className="h-3.5 w-3.5" aria-hidden="true" />{t('visibility.live')}</>
                      ) : (
                        <><EyeOff className="h-3.5 w-3.5" aria-hidden="true" />{t('visibility.hidden')}</>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
        {t('footnote')}
      </p>
    </div>
  );
}
