import type {
  CompatibilityScore,
  EnrichedMatchRequestsResponse,
  MatchFeedItem,
  MatchRequest,
  MatchRequestPriority,
  MatchRequestsResponse,
  ProfileDetailResponse,
} from '@smartshaadi/types';
import type { ApiClient } from '../client.js';

/** Feed responses are paginated; the envelope's `meta` carries the page info. */
export interface FeedPage {
  items: MatchFeedItem[];
  page: number;
  hasMore: boolean;
}

export interface FeedParams {
  page?: number;
  limit?: number;
  /** Bypass the Redis match_feed cache and recompute. */
  refresh?: boolean;
}

/**
 * A row from `GET /matchmaking/blocks`. Mirrors `BlockedUserItem` in
 * apps/api/src/matchmaking/requests/service.ts. `name`/`primaryPhotoKey` are
 * null when the blocked profile has no display data left to show.
 */
export interface BlockedUser {
  blockId: string;
  profileId: string;
  name: string | null;
  primaryPhotoKey: string | null;
  reason: string | null;
  blockedAt: string;
}

/**
 * Matchmaking surface — Track B's endpoints.
 *
 * Paths verified against apps/api/src/matchmaking/router.ts and its two
 * sub-mounts (`matchRequestsRouter` at '/', `shortlistsRouter` at '/shortlists'),
 * all under the '/api/v1/matchmaking' prefix from apps/api/src/index.ts.
 */
export class MatchmakingEndpoints {
  constructor(private readonly client: ApiClient) {}

  getFeed(params: FeedParams = {}): Promise<FeedPage> {
    return this.client.get<FeedPage>('/api/v1/matchmaking/feed', {
      query: {
        page: params.page,
        limit: params.limit,
        refresh: params.refresh,
      },
    });
  }

  getProfile(profileId: string): Promise<ProfileDetailResponse> {
    return this.client.get<ProfileDetailResponse>(`/api/v1/profiles/${profileId}`);
  }

  getScore(profileId: string): Promise<CompatibilityScore> {
    return this.client.get<CompatibilityScore>(
      `/api/v1/matchmaking/score/${profileId}`,
    );
  }

  getProfileOfDay(): Promise<MatchFeedItem | null> {
    return this.client.get<MatchFeedItem | null>(
      '/api/v1/matchmaking/profile-of-day',
    );
  }

  getSimilar(profileId: string): Promise<MatchFeedItem[]> {
    return this.client.get<MatchFeedItem[]>(
      `/api/v1/matchmaking/similar/${profileId}`,
    );
  }

  getWhoLikedMe(): Promise<MatchFeedItem[]> {
    return this.client.get<MatchFeedItem[]>('/api/v1/matchmaking/who-liked-me');
  }

  // ── Requests ──────────────────────────────────────────────────────────────

  sendRequest(input: {
    toProfileId: string;
    message?: string;
    priority?: MatchRequestPriority;
  }): Promise<MatchRequest> {
    return this.client.post<MatchRequest>('/api/v1/matchmaking/requests', input);
  }

  getReceivedRequests(page = 1, limit = 20): Promise<MatchRequestsResponse> {
    return this.client.get<MatchRequestsResponse>(
      '/api/v1/matchmaking/requests/received',
      { query: { page, limit } },
    );
  }

  getSentRequests(page = 1, limit = 20): Promise<MatchRequestsResponse> {
    return this.client.get<MatchRequestsResponse>(
      '/api/v1/matchmaking/requests/sent',
      { query: { page, limit } },
    );
  }

  getEnrichedRequests(): Promise<EnrichedMatchRequestsResponse> {
    return this.client.get<EnrichedMatchRequestsResponse>(
      '/api/v1/matchmaking/requests/enriched',
    );
  }

  getRequestStatus(profileId: string): Promise<{ status: string | null }> {
    return this.client.get<{ status: string | null }>(
      `/api/v1/matchmaking/requests/status/${profileId}`,
    );
  }

  acceptRequest(requestId: string): Promise<MatchRequest> {
    return this.client.put<MatchRequest>(
      `/api/v1/matchmaking/requests/${requestId}/accept`,
    );
  }

  declineRequest(requestId: string): Promise<MatchRequest> {
    return this.client.put<MatchRequest>(
      `/api/v1/matchmaking/requests/${requestId}/decline`,
    );
  }

  markRequestSeen(requestId: string): Promise<void> {
    return this.client.put<void>(
      `/api/v1/matchmaking/requests/${requestId}/seen`,
    );
  }

  // ── Shortlists ────────────────────────────────────────────────────────────

  getShortlist(page = 1, limit = 20): Promise<{ items: MatchFeedItem[] }> {
    return this.client.get<{ items: MatchFeedItem[] }>(
      '/api/v1/matchmaking/shortlists/mine',
      { query: { page, limit } },
    );
  }

  addShortlist(targetProfileId: string): Promise<void> {
    return this.client.post<void>(
      `/api/v1/matchmaking/shortlists/${targetProfileId}`,
    );
  }

  removeShortlist(targetProfileId: string): Promise<void> {
    return this.client.delete<void>(
      `/api/v1/matchmaking/shortlists/${targetProfileId}`,
    );
  }

  isShortlisted(targetProfileId: string): Promise<{ shortlisted: boolean }> {
    return this.client.get<{ shortlisted: boolean }>(
      `/api/v1/matchmaking/shortlists/is-shortlisted/${targetProfileId}`,
    );
  }

  // ── Safety ────────────────────────────────────────────────────────────────

  blockProfile(profileId: string): Promise<void> {
    return this.client.post<void>(`/api/v1/matchmaking/block/${profileId}`);
  }

  /** The caller's blocked list, enriched with name + primary photo. */
  getBlockedUsers(): Promise<{ blocks: BlockedUser[]; total: number }> {
    return this.client.get<{ blocks: BlockedUser[]; total: number }>(
      '/api/v1/matchmaking/blocks',
    );
  }

  unblockProfile(profileId: string): Promise<{ unblocked: boolean }> {
    return this.client.delete<{ unblocked: boolean }>(
      `/api/v1/matchmaking/block/${profileId}`,
    );
  }

  reportProfile(
    profileId: string,
    input: { category: string; details?: string },
  ): Promise<void> {
    return this.client.post<void>(
      `/api/v1/matchmaking/report/${profileId}`,
      input,
    );
  }
}
