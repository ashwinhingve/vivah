import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { VendorListParams } from '@smartshaadi/api-client';
import { api } from '../../lib/api';

/** Server default is 12; 20 fills a phone screen with less paging. */
const PAGE_SIZE = 20;

/**
 * Paginated vendor browse.
 *
 * `filters` is part of the query key, so changing a filter starts a NEW cache
 * entry rather than appending filtered results onto the previous list — the
 * bug you get for free if you keep a static key and rely on refetch.
 */
export function useVendorList(filters: VendorListParams = {}) {
  return useInfiniteQuery({
    queryKey: ['vendors', 'list', filters],
    queryFn: ({ pageParam }) =>
      api.vendors.list({ ...filters, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, total, limit } = lastPage.meta;
      // `total` is the unpaged row count, so compare against what we have shown
      // so far rather than against this page's length: a final page that lands
      // exactly on the limit would otherwise look like "there is more".
      return page * limit < total ? page + 1 : undefined;
    },
    staleTime: 60_000,
  });
}

export function useVendorDetail(vendorId: string) {
  return useQuery({
    queryKey: ['vendors', 'detail', vendorId],
    queryFn: () => api.vendors.get(vendorId),
    enabled: Boolean(vendorId),
  });
}

export function useVendorReviews(vendorId: string) {
  return useQuery({
    queryKey: ['vendors', 'reviews', vendorId],
    queryFn: () => api.vendors.getReviews(vendorId),
    enabled: Boolean(vendorId),
  });
}

/**
 * Booked + blocked dates for one `YYYY-MM` month. `month` is part of the key so
 * paging to a different month is a fresh fetch rather than a silent overwrite.
 */
export function useVendorAvailability(vendorId: string, month: string) {
  return useQuery({
    queryKey: ['vendors', 'availability', vendorId, month],
    queryFn: () => api.vendors.getAvailability(vendorId, month),
    enabled: Boolean(vendorId) && Boolean(month),
    staleTime: 60_000,
  });
}

export function useFavoriteVendors() {
  return useQuery({
    queryKey: ['vendors', 'favorites'],
    queryFn: () => api.vendors.getFavorites(),
  });
}

/**
 * Favourite toggle.
 *
 * Invalidates the whole `['vendors']` subtree because `isFavorite` is embedded
 * in list rows AND detail AND the favourites list; invalidating only the
 * favourites query would leave a stale filled heart on the card the user just
 * tapped.
 */
export function useToggleFavoriteVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vendorId: string) => api.vendors.toggleFavorite(vendorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

export function useSendVendorInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      vendorId: string;
      message: string;
      eventDate?: string;
      phone?: string;
    }) => {
      const { vendorId, ...body } = input;
      return api.vendors.sendInquiry(vendorId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendors', 'inquiries'] });
    },
  });
}
