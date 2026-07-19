'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MarketingCampaign } from '@smartshaadi/types';

// Cross-origin api base (ADR-002): cookies only travel with credentials:'include'.
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface CampaignTransitionButtonsProps {
  campaign: MarketingCampaign;
}

type Action = 'approve' | 'activate' | 'pause' | 'resume' | 'complete';

export function CampaignTransitionButtons({ campaign }: CampaignTransitionButtonsProps) {
  const t = useTranslations('adminMarketing');
  const [loading, setLoading] = useState(false);

  // Determine available actions based on status
  const getAvailableActions = (): Action[] => {
    const actions: Action[] = [];
    const status = campaign.status;

    if (status === 'DRAFT') actions.push('approve');
    if (status === 'APPROVED') actions.push('activate');
    if (status === 'ACTIVE') actions.push('pause', 'complete');
    if (status === 'PAUSED') actions.push('resume');

    return actions;
  };

  const handleTransition = async (action: Action) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/marketing/${campaign.id}/transition`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  const availableActions = getAvailableActions();

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <>
      {availableActions.map((action) => (
        <button
          key={action}
          onClick={() => handleTransition(action)}
          disabled={loading}
          className={`inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-primary-foreground transition-colors disabled:opacity-50 ${ACTION_TONE[action]}`}
        >
          {t(`actions.${action}`)}
        </button>
      ))}
    </>
  );
}

/** Brand-token tones per action — no raw hex (design-system rule). */
const ACTION_TONE: Record<Action, string> = {
  approve:  'bg-success hover:bg-success/90',
  activate: 'bg-teal hover:bg-teal/90',
  pause:    'bg-warning hover:bg-warning/90',
  resume:   'bg-teal hover:bg-teal/90',
  complete: 'bg-muted-foreground hover:bg-muted-foreground/90',
};
