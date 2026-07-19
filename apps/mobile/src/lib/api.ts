import { createSmartShaadiApi, type SmartShaadiApi } from '@smartshaadi/api-client';
import { getSessionCookie } from './auth-client';
import { API_BASE_URL } from './env';

/**
 * The app's single API client instance.
 *
 * Screens import `api` and call `api.matchmaking.getFeed()` etc. They never
 * construct a client, never build a URL, and never see the `{ success, data,
 * error, meta }` envelope — that all lives in `@smartshaadi/api-client`.
 *
 * The credential is passed as a *getter*, not a value: the session changes
 * (sign-in, sign-out, token rotation on refresh) and a captured string would go
 * stale, producing 401s that look like a server problem.
 */
export const api: SmartShaadiApi = createSmartShaadiApi({
  baseUrl: API_BASE_URL,
  getCookieHeader: getSessionCookie,
});

export { ApiRequestError, NetworkError } from '@smartshaadi/api-client';
