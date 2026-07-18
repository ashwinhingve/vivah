'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MarketingCampaign } from '@smartshaadi/types';

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
      const res = await fetch(`/api/v1/admin/marketing/${campaign.id}/transition`, {
        method: 'POST',
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
          className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{
            backgroundColor: getActionColor(action),
            color: 'white',
          }}
        >
          {t(`actions.${action}`)}
        </button>
      ))}
    </>
  );
}

function getActionColor(action: Action): string {
  const colors: Record<Action, string> = {
    approve: '#059669', // green
    activate: '#0E7C7B', // teal
    pause: '#D97706', // amber
    resume: '#0E7C7B', // teal
    complete: '#6B7280', // gray
  };
  return colors[action];
}
