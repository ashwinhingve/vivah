import { redirect } from '@/i18n/redirect';
import { Check, Minus } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { fetchMyVendor, fetchVendorStatus } from '@/lib/vendor-onboarding-api';
import { OnboardingStepper } from '@/components/vendor/OnboardingStepper';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { SubmitReview } from './SubmitReview.client';

export const metadata = { title: 'Review · Vendor onboarding' };
export const dynamic = 'force-dynamic';

interface ServiceRow { id: string }
interface VendorDetail {
  id: string;
  businessName?: string;
  category?: string;
  city?: string;
  state?: string;
  services?: ServiceRow[];
}
interface PortfolioBasics { about?: string | null }

function Row({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          done ? 'bg-success/15 text-success' : 'bg-surface-muted text-text-muted'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      </span>
      <span className={done ? 'text-sm text-primary' : 'text-sm text-text-muted'}>{label}</span>
    </li>
  );
}

export default async function ReviewStepPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'VENDOR' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const vendor = await fetchMyVendor();
  if (!vendor?.id) return await redirect('/vendor/onboarding/business');

  const [detail, portfolioRes, eventTypesRes, status] = await Promise.all([
    fetchAuth<VendorDetail>(`/api/v1/vendors/${vendor.id}`),
    fetchAuth<{ portfolio: PortfolioBasics | null }>(`/api/v1/vendors/${vendor.id}/portfolio`),
    fetchAuth<{ eventTypes: string[] }>(`/api/v1/vendors/${vendor.id}/event-types`),
    fetchVendorStatus(),
  ]);

  const hasBusiness = Boolean(detail?.businessName && detail?.category && detail?.city);
  const serviceCount = detail?.services?.length ?? 0;
  const hasServices = serviceCount > 0;
  const hasAbout = Boolean(portfolioRes?.portfolio?.about);
  const eventTypeCount = eventTypesRes?.eventTypes?.length ?? 0;

  const canSubmit = hasBusiness && hasServices;
  const alreadySubmitted = status?.status === 'PENDING' || status?.status === 'UNDER_REVIEW' || status?.status === 'APPROVED';

  return (
    <FadeUp>
      <OnboardingStepper current="review" />
      <div className="mb-4">
        <h2 className="font-heading text-lg text-primary">Review &amp; submit</h2>
        <p className="text-sm text-muted-foreground">
          Here’s what couples will see. Submit when you’re ready — you can keep editing while we review.
        </p>
      </div>

      <div className="mb-5 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
        <ul className="divide-y divide-border">
          <Row done={hasBusiness} label={hasBusiness ? `Business: ${detail?.businessName}` : 'Business details'} />
          <Row done={hasServices} label={hasServices ? `${serviceCount} service${serviceCount === 1 ? '' : 's'} added` : 'At least one service'} />
          <Row done={hasAbout} label={hasAbout ? 'Portfolio “about” written' : 'Portfolio “about” (recommended)'} />
          <Row done={eventTypeCount > 0} label={eventTypeCount > 0 ? `${eventTypeCount} event type${eventTypeCount === 1 ? '' : 's'} selected` : 'Event types (for coordinator routing)'} />
        </ul>
      </div>

      <SubmitReview canSubmit={canSubmit} alreadySubmitted={alreadySubmitted} />
    </FadeUp>
  );
}
