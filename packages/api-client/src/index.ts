/**
 * `@smartshaadi/api-client` — the typed HTTP surface of the Smart Shaadi API.
 *
 * Built for `apps/mobile` (React Native has no Server Actions, so every mutation
 * the web app does through a `'use server'` wrapper has to be a plain REST call
 * here). Written to be consumable from `apps/web` too — it takes its base URL
 * and its credential as constructor arguments and imports nothing
 * platform-specific — but migrating web is deliberately NOT part of Sprint I.
 *
 * Scope: the matchmaking core, vendor discovery + booking, and billing
 * (read plus Razorpay-hosted subscribe/cancel). Weddings, store, b2b and admin
 * remain web-only surfaces; stubbing them here would imply a mobile commitment
 * that does not exist.
 */
export { ApiClient, createApiClient } from './client.js';
export type {
  ApiClientConfig,
  GetCookieHeader,
  RequestOptions,
} from './client.js';

export { ApiRequestError, NetworkError } from './errors.js';

export { MatchmakingEndpoints } from './endpoints/matchmaking.js';
export type { BlockedUser, FeedPage, FeedParams } from './endpoints/matchmaking.js';

export { ProfileEndpoints } from './endpoints/profiles.js';
export type {
  PresignedUpload,
  UploadFolder,
  UploadMimeType,
} from './endpoints/profiles.js';

export { ChatEndpoints } from './endpoints/chat.js';
export type { ConversationFilter } from './endpoints/chat.js';

export { UserEndpoints } from './endpoints/users.js';
export type {
  DevicePlatform,
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from './endpoints/users.js';

export { VendorEndpoints } from './endpoints/vendors.js';
export type {
  VendorAvailability,
  VendorListPage,
  VendorListParams,
  VendorSort,
} from './endpoints/vendors.js';

export { BookingEndpoints } from './endpoints/bookings.js';
export type {
  BookingListPage,
  BookingListParams,
  BookingRole,
  BookingStatusFilter,
  BookingTimeline,
  CreateBookingInput,
} from './endpoints/bookings.js';

export { PaymentEndpoints } from './endpoints/payments.js';
export type {
  ActiveSubscription,
  StartSubscriptionResult,
  SubscriptionPlan,
} from './endpoints/payments.js';

import { ApiClient, type ApiClientConfig } from './client.js';
import { BookingEndpoints } from './endpoints/bookings.js';
import { ChatEndpoints } from './endpoints/chat.js';
import { MatchmakingEndpoints } from './endpoints/matchmaking.js';
import { PaymentEndpoints } from './endpoints/payments.js';
import { ProfileEndpoints } from './endpoints/profiles.js';
import { UserEndpoints } from './endpoints/users.js';
import { VendorEndpoints } from './endpoints/vendors.js';

/**
 * One object carrying every endpoint group, so screens import a single `api`
 * rather than wiring up groups themselves.
 *
 * The groups are separate classes (not one giant client) specifically so the
 * three Phase-1 tracks edit different files: Track A owns `profiles.ts`, Track B
 * owns `matchmaking.ts`, Track C owns `chat.ts` + `users.ts`. Adding an endpoint
 * mid-sprint therefore never produces a merge conflict between tracks.
 */
export interface SmartShaadiApi {
  raw: ApiClient;
  profiles: ProfileEndpoints;
  matchmaking: MatchmakingEndpoints;
  chat: ChatEndpoints;
  users: UserEndpoints;
  vendors: VendorEndpoints;
  bookings: BookingEndpoints;
  payments: PaymentEndpoints;
}

export function createSmartShaadiApi(config: ApiClientConfig): SmartShaadiApi {
  const raw = new ApiClient(config);
  return {
    raw,
    profiles: new ProfileEndpoints(raw),
    matchmaking: new MatchmakingEndpoints(raw),
    chat: new ChatEndpoints(raw),
    users: new UserEndpoints(raw),
    vendors: new VendorEndpoints(raw),
    bookings: new BookingEndpoints(raw),
    payments: new PaymentEndpoints(raw),
  };
}
