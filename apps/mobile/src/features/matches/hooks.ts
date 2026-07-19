import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
  CompatibilityScore,
  MatchFeedItem,
  MatchRequest,
  MatchRequestPriority,
  MatchRequestsResponse,
} from '@smartshaadi/types';
import { api } from '../../lib/api';

/**
 * Infinite query hook for the match feed.
 * Pagination controlled by React Query's useInfiniteQuery with getNextPageParam.
 * Pull-to-refresh via refetch().
 */
export function useMatchFeed() {
  return useInfiniteQuery({
    queryKey: ['matchFeed'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.matchmaking.getFeed({ page: pageParam, limit: 20 });
      return response;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? (lastPage.page ?? 1) + 1 : undefined;
    },
    staleTime: 60_000,
  });
}

/**
 * Query hook for a single profile detail.
 * Includes fetch status and refetch capability.
 */
export function useProfileDetail(profileId: string) {
  return useQuery({
    queryKey: ['profile', profileId],
    queryFn: () => api.matchmaking.getProfile(profileId),
    enabled: !!profileId,
  });
}

/**
 * Query hook for compatibility score breakdown.
 * Used in profile detail and feed cards.
 */
export function useCompatibilityScore(profileId: string) {
  return useQuery({
    queryKey: ['score', profileId],
    queryFn: () => api.matchmaking.getScore(profileId),
    enabled: !!profileId,
  });
}

/**
 * Mutation hook for sending a match request.
 * Invalidates feed and requests queries on success.
 */
export function useSendMatchRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    // `priority` is the real union, not `string`. It was typed as string and
    // cast with `as any` at the call site, which meant a typo like 'SUPERLIKE'
    // type-checked here and came back a 400 from the server at runtime.
    mutationFn: (input: {
      toProfileId: string;
      message?: string;
      priority?: MatchRequestPriority;
    }) =>
      api.matchmaking.sendRequest({
        toProfileId: input.toProfileId,
        message: input.message,
        priority: input.priority,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchFeed'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

/**
 * Mutation hook for accepting a match request.
 */
export function useAcceptRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => api.matchmaking.acceptRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['matchFeed'] });
    },
  });
}

/**
 * Mutation hook for declining a match request.
 */
export function useDeclineRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => api.matchmaking.declineRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['matchFeed'] });
    },
  });
}

/**
 * Query hook for received match requests with pagination.
 */
export function useReceivedRequests(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['requests', 'received', page],
    queryFn: () => api.matchmaking.getReceivedRequests(page, limit),
  });
}

/**
 * Query hook for sent match requests with pagination.
 */
export function useSentRequests(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['requests', 'sent', page],
    queryFn: () => api.matchmaking.getSentRequests(page, limit),
  });
}

/**
 * Mutation hook for adding a profile to shortlist.
 */
export function useAddShortlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => api.matchmaking.addShortlist(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      queryClient.invalidateQueries({ queryKey: ['matchFeed'] });
    },
  });
}

/**
 * Mutation hook for removing a profile from shortlist.
 */
export function useRemoveShortlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => api.matchmaking.removeShortlist(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      queryClient.invalidateQueries({ queryKey: ['matchFeed'] });
    },
  });
}

/**
 * Query hook for checking if a profile is shortlisted.
 */
export function useIsShortlisted(profileId: string) {
  return useQuery({
    queryKey: ['isShortlisted', profileId],
    queryFn: () => api.matchmaking.isShortlisted(profileId),
    enabled: !!profileId,
  });
}

/**
 * Infinite query hook for shortlisted profiles.
 */
export function useShortlistFeed() {
  return useInfiniteQuery({
    queryKey: ['shortlist'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.matchmaking.getShortlist(pageParam, 20);
      return {
        items: response.items,
        page: pageParam,
        hasMore: response.items.length === 20,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? (lastPage.page ?? 1) + 1 : undefined;
    },
  });
}

/**
 * Mutation hook for blocking a profile.
 */
export function useBlockProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => api.matchmaking.blockProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchFeed'] });
    },
  });
}

/**
 * Mutation hook for reporting a profile.
 */
export function useReportProfile() {
  return useMutation({
    mutationFn: (input: { profileId: string; category: string; details?: string }) =>
      api.matchmaking.reportProfile(input.profileId, {
        category: input.category,
        details: input.details,
      }),
  });
}
