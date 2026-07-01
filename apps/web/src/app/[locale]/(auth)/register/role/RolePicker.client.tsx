'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { UserRole } from '@smartshaadi/types';
import { authClient } from '@/lib/auth-client';
import { setRoleAction } from '../../actions';

const ROLES: { value: UserRole; icon: string }[] = [
  { value: 'INDIVIDUAL', icon: '👤' },
  { value: 'FAMILY_MEMBER', icon: '👨‍👩‍👧' },
  { value: 'VENDOR', icon: '🏪' },
  { value: 'EVENT_COORDINATOR', icon: '📋' },
];

export default function RolePicker() {
  const t = useTranslations('auth.role');
  const locale = useLocale();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    const result = await setRoleAction(selected);

    if (!result.success) {
      setError(result.error ?? t('errors.setFailed'));
      setLoading(false);
      return;
    }

    // The DB role was just changed, but Better Auth's 5-min cookie cache still
    // holds the old role. Force a fresh session read (rewrites the session_data
    // cache cookie) then hard-navigate so middleware + client both see the new
    // role immediately — otherwise the user sees the INDIVIDUAL nav for ~5 min.
    await authClient.getSession({ query: { disableCookieCache: true } });
    window.location.assign(`/${locale}/dashboard`);
  }

  return (
    <div className="w-full max-w-sm bg-surface rounded-xl shadow-sm border border-gold/20 p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-foreground font-heading">
          {t('heading')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t('subtext')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ROLES.map((role) => {
          const isSelected = selected === role.value;
          const label = t(`roles.${role.value}.label`);
          return (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelected(role.value)}
              aria-pressed={isSelected}
              className={[
                'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all',
                isSelected
                  ? 'border-teal bg-teal/5 ring-2 ring-teal/20'
                  : 'border-gold/40 hover:border-gold/70 bg-surface',
              ].join(' ')}
            >
              <span className="text-2xl" role="img" aria-label={label}>
                {role.icon}
              </span>
              <span className={`text-sm font-semibold ${isSelected ? 'text-teal' : 'text-foreground'}`}>
                {label}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                {t(`roles.${role.value}.description`)}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="button"
        onClick={() => { void handleContinue(); }}
        disabled={!selected || loading}
        className="w-full min-h-[44px] rounded-lg bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-surface/30 border-t-white animate-spin" />
            {t('settingUp')}
          </>
        ) : (
          t('continue')
        )}
      </button>
    </div>
  );
}
