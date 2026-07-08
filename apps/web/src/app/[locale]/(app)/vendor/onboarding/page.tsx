import { redirect } from '@/i18n/redirect';
import { fetchVendorStatus } from '@/lib/vendor-onboarding-api';

/**
 * Entry point — approved vendors land on their dashboard; everyone else
 * (no account yet, still drafting, or under review) starts the wizard
 * at the business step.
 */
export default async function VendorOnboardingIndexPage() {
  const status = await fetchVendorStatus();
  if (status?.status === 'APPROVED') return await redirect('/vendor-dashboard');
  return await redirect('/vendor/onboarding/business');
}
