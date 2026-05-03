/**
 * Smart Shaadi — StrengthTipsPanel
 * apps/web/src/components/profile/StrengthTipsPanel.tsx
 *
 * Server component. Fetches /me/strength-tips and renders an ordered, deep-
 * linked list of profile-improvement tips with impact labels.
 */

import Link from 'next/link';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchAuth } from '@/lib/server-fetch';

interface StrengthTip {
  id: string;
  tip: string;
  impactLabel: string;
  fieldPath: string;
  priority: number;
}

interface Response {
  tips: StrengthTip[];
  completeness: number;
}

export async function StrengthTipsPanel() {
  const data = await fetchAuth<Response>('/api/v1/profiles/me/strength-tips');
  if (!data) return null;
  if (data.tips.length === 0) {
    return (
      <Card className="border-emerald-200 bg-success/10 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-semibold text-success">Profile is fully built</p>
            <p className="text-xs text-success">No further suggestions — keep it up.</p>
          </div>
        </div>
      </Card>
    );
  }
  const top = data.tips.slice(0, 5);
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-warning" />
        <h2 className="text-sm font-semibold text-foreground">Boost your profile</h2>
        <span className="ml-auto text-xs text-muted-foreground">{data.completeness}% complete</span>
      </div>
      <ul className="space-y-2">
        {top.map((tip) => (
          <li key={tip.id}>
            <Link
              href={tip.fieldPath}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-teal hover:bg-teal/5"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{tip.tip}</p>
                <p className="text-xs text-success">{tip.impactLabel}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
