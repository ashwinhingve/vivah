/**
 * Smart Shaadi — typed analytics events.
 *
 * Single source of truth for the named product events (UX audit framework
 * Wave 2 funnel events + store/marketplace events added in premium-UI phase 5).
 *
 * Why typed: untyped posthog.capture('foo') calls drift over time — different
 * spellings, different prop shapes, no way to grep the funnel. This module
 * pins the names and prop shapes so analytics queries stay stable.
 *
 * Server-side note: this file lives in apps/web/src/lib but only the `track`
 * helper is safe to call from client components. Server actions that need to
 * fire an event should call a server-side PostHog SDK directly (Wave 3 work);
 * for now, fire from the immediate post-action client callback.
 */

import posthog from 'posthog-js';

export type AnalyticsEvent =
  // Onboarding funnel
  | { name: 'onboarding_step_completed'; props: { step: OnboardingStep } }
  | { name: 'register_started'; props: { role: string } }
  | { name: 'login_otp_sent'; props: Record<string, never> }
  | { name: 'login_otp_verified'; props: { isNewUser: boolean } }
  // KYC
  | { name: 'kyc_started'; props: { level: 'L1' | 'L2' | 'L3' } }
  | { name: 'kyc_document_uploaded'; props: { docType: string } }
  | { name: 'kyc_completed'; props: { level: 'L1' | 'L2' | 'L3' } }
  | { name: 'kyc_rejected'; props: { reason?: string } }
  // Matching
  | { name: 'profile_viewed'; props: { profileId: string } }
  | { name: 'match_liked'; props: { profileId: string } }
  | { name: 'match_requested'; props: { profileId: string } }
  | { name: 'chat_started'; props: { matchId: string } }
  // Commerce
  | { name: 'vendor_inquired'; props: { vendorId: string } }
  | { name: 'booking_created'; props: { bookingId: string } }
  | { name: 'payment_initiated'; props: { amountPaise: number; currency: 'INR' } }
  | { name: 'payment_success'; props: { paymentId: string; amountPaise: number } }
  | { name: 'payment_failed'; props: { reason?: string } }
  // Wedding workspace
  | { name: 'wedding_created'; props: { weddingId: string } }
  | { name: 'wedding_section_viewed'; props: { section: WeddingSection } }
  // Store / marketplace
  | { name: 'store_product_viewed'; props: { productId: string; category?: string } }
  | { name: 'store_add_to_cart'; props: { productId: string; quantity: number; pricePaise: number } }
  | { name: 'store_checkout_started'; props: { itemCount: number; totalPaise: number } }
  | { name: 'store_order_completed'; props: { orderId: string; itemCount: number; totalPaise: number } }
  | { name: 'store_filter_used'; props: { filter: 'category' | 'search' | 'sort'; value: string } };

export type OnboardingStep =
  | 'personal'
  | 'career'
  | 'community'
  | 'family'
  | 'horoscope'
  | 'lifestyle'
  | 'personality'
  | 'photos'
  | 'preferences'
  | 'kyc';

export type WeddingSection =
  | 'overview'
  | 'budget'
  | 'guests'
  | 'tasks'
  | 'vendors'
  | 'timeline'
  | 'ceremonies'
  | 'seating'
  | 'moodboard'
  | 'website'
  | 'day-of';

/**
 * Fire an analytics event. No-op when PostHog isn't initialised (SSR, no key,
 * pre-mount). Never throws — analytics failure must not break user flows.
 */
export function track<E extends AnalyticsEvent>(name: E['name'], props: E['props']): void {
  if (typeof window === 'undefined') return;
  try {
    posthog.capture(name, props as Record<string, unknown>);
  } catch {
    // swallow — analytics must never block UX
  }
}
