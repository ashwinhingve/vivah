import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from '@smartshaadi/api-client';
import { api } from '../../lib/api';

const KEY = ['notificationPreferences'] as const;

/** Current per-channel notification switches. */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.users.getNotificationPreferences(),
  });
}

/**
 * Toggle a channel. Optimistic: the switch flips instantly and rolls back if the
 * server rejects — a settings toggle that lags a network round-trip feels broken,
 * and reverting on error is more honest than leaving the UI ahead of the server.
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NotificationPreferencesUpdate) =>
      api.users.updateNotificationPreferences(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const prev = queryClient.getQueryData<NotificationPreferences>(KEY);
      if (prev) {
        queryClient.setQueryData<NotificationPreferences>(KEY, {
          ...prev,
          ...input,
        });
      }
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) queryClient.setQueryData(KEY, context.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
