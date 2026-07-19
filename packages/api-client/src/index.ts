/**
 * `@smartshaadi/api-client` — the typed HTTP surface of the Smart Shaadi API.
 *
 * Built for `apps/mobile` (React Native has no Server Actions, so every mutation
 * the web app does through a `'use server'` wrapper has to be a plain REST call
 * here). Written to be consumable from `apps/web` too — it takes its base URL
 * and its credential as constructor arguments and imports nothing
 * platform-specific — but migrating web is deliberately NOT part of Sprint I.
 *
 * Scope: the matchmaking core, plus vendor discovery and read-only billing.
 * Weddings, bookings, store, b2b and admin are intentionally absent; they are
 * web-only surfaces for now, and stubbing them here would imply a mobile
 * commitment that does not exist. Vendor BOOKING is absent for the same reason
 * even though vendor browsing is present — see the note on VendorEndpoints.
 */
export { ApiClient, createApiClient } from './client.js';
export type {
  ApiClientConfig,
  GetCookieHeader,
  RequestOptions,
} from './client.js';

export { ApiRequestError, NetworkError } from './errors.js';

export { MatchmakingEndpoints } from './endpoints/matchmaking.js';
export type { FeedPage, FeedParams } from './endpoints/matchmaking.js';

export { ProfileEndpoints } from './endpoints/profiles.js';
export type {
  PresignedUpload,
  UploadFolder,
  UploadMimeType,
} from './endpoints/profiles.js';

export { ChatEndpoints } from './endpoints/chat.js';
export type { ConversationFilter } from './endpoints/chat.js';

export { UserEndpoints } from './endpoints/users.js';
export type { DevicePlatform } from './endpoints/users.js';

export { VendorEndpoints } from './endpoints/vendors.js';
export type {
  VendorListPage,
  VendorListParams,
  VendorSort,
} from './endpoints/vendors.js';

export { PaymentEndpoints } from './endpoints/payments.js';
export type {
  ActiveSubscription,
  SubscriptionPlan,
} from './endpoints/payments.js';

import { ApiClient, type ApiClientConfig } from './client.js';
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
    payments: new PaymentEndpoints(raw),
  };
}
