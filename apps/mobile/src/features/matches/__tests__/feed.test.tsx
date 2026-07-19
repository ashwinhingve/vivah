import { screen, waitFor } from '@testing-library/react-native';
import { renderWithQuery, feedItem } from './testUtils';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  // No-op, deliberately. The real useFocusEffect defers to an effect; invoking
  // the callback inline during render re-enters refetch() on every render and
  // the query never settles — the screen sits in its loading state forever.
  useFocusEffect: jest.fn(),
}));

jest.mock('../../../lib/api', () => {
  class ApiRequestError extends Error {
    httpStatus: number;
    code: string;
    constructor(code: string, message: string, httpStatus: number) {
      super(message);
      this.code = code;
      this.httpStatus = httpStatus;
    }
    get isUnauthorized() {
      return this.httpStatus === 401;
    }
    get isForbidden() {
      return this.httpStatus === 403;
    }
  }
  class NetworkError extends Error {}
  return {
    api: { matchmaking: { getFeed: jest.fn() } },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import MatchFeedScreen from '../../../app/(app)/(matches)/index';

const getFeed = api.matchmaking.getFeed as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// Queries come from the render result rather than the global `screen`: with the
// jest-expo preset the module instance backing `screen` is not always the one
// `render` binds, which surfaces as a misleading "`render` function has not
// been called" on assertions that run long after a successful render.
describe('MatchFeedScreen', () => {
  it('requests the first page and renders profiles from the response', async () => {
    getFeed.mockResolvedValue({
      items: [
        feedItem(),
        feedItem({ profileId: 'profile-2', name: 'Priya Patel', city: 'Delhi', age: 26 }),
      ],
      page: 1,
      hasMore: false,
    });

    await renderWithQuery(<MatchFeedScreen />);

    // Values that could ONLY have come from the mocked response.
    expect(await screen.findByText(/Alice Johnson/)).toBeTruthy();
    expect(await screen.findByText(/Priya Patel/)).toBeTruthy();
    expect(screen.getByText('Mumbai')).toBeTruthy();
    expect(screen.getByText('Delhi')).toBeTruthy();

    expect(getFeed).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('renders the compatibility score from the response, not a placeholder', async () => {
    getFeed.mockResolvedValue({
      items: [
        feedItem({ compatibility: { ...feedItem().compatibility, totalScore: 92 } }),
      ],
      page: 1,
      hasMore: false,
    });

    await renderWithQuery(<MatchFeedScreen />);

    expect(await screen.findByText('92%')).toBeTruthy();
  });

  it('shows the empty state when the API returns no profiles', async () => {
    getFeed.mockResolvedValue({ items: [], page: 1, hasMore: false });

    await renderWithQuery(<MatchFeedScreen />);

    expect(await screen.findByText('No matches yet')).toBeTruthy();
    // No profile card may leak into the empty state.
    expect(screen.queryByText(/Alice Johnson/)).toBeNull();
  });

  it('shows an error state, with retry, when the request fails', async () => {
    const { NetworkError } = jest.requireMock('../../../lib/api');
    getFeed.mockRejectedValue(new NetworkError('offline'));

    await renderWithQuery(<MatchFeedScreen />);

    // NetworkError is the retryable class, so the retry affordance must appear.
    await waitFor(() => {
      expect(screen.getByText("Can't connect")).toBeTruthy();
    });
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
