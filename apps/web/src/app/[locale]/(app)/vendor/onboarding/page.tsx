import { redirect } from '@/i18n/redirect';

/** Entry point — the wizard always starts at the business step. */
export default async function VendorOnboardingIndexPage() {
  return await redirect('/vendor/onboarding/business');
}
