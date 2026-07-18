import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithQuery } from './testUtils';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('../../../lib/api', () => ({
  api: {
    matchmaking: {
      getReceivedRequests: jest.fn(),
      getSentRequests: jest.fn(),
      acceptRequest: jest.fn(),
      declineRequest: jest.fn(),
    },
  },
  ApiRequestError: class extends Error {},
  NetworkError: class extends Error {},
}));

import { api } from '../../../lib/api';
import MatchRequestsScreen from '../../../app/(app)/(matches)/requests';

const getReceived = api.matchmaking.getReceivedRequests as jest.Mock;
const getSent = api.matchmaking.getSentRequests as jest.Mock;
const acceptRequest = api.matchmaking.acceptRequest as jest.Mock;
const declineRequest = api.matchmaking.declineRequest as jest.Mock;

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    status: 'PENDING',
    message: 'Namaste, I liked your profile',
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getSent.mockResolvedValue({ requests: [], total: 0 });
  acceptRequest.mockResolvedValue({ ...request(), status: 'ACCEPTED' });
  declineRequest.mockResolvedValue({ ...request(), status: 'DECLINED' });
});

describe('MatchRequestsScreen', () => {
  it('renders received requests from the API response', async () => {
    getReceived.mockResolvedValue({ requests: [request()], total: 1 });

    await renderWithQuery(<MatchRequestsScreen />);

    // The message text can only have come from the mocked response.
    expect(await screen.findByText(/I liked your profile/)).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(getReceived).toHaveBeenCalled();
  });

  it('accepts a request with the id of the row that was pressed', async () => {
    getReceived.mockResolvedValue({
      requests: [request({ id: 'req-42' })],
      total: 1,
    });

    await renderWithQuery(<MatchRequestsScreen />);

    fireEvent.press(await screen.findByText('Accept'));

    // The specific id matters: passing the wrong one silently accepts the
    // wrong person's request, which no amount of "it rendered" would catch.
    // waitFor: mutateAsync dispatches in a microtask, so asserting synchronously
    // right after the press races the mutation and observes zero calls.
    await waitFor(() => {
      expect(acceptRequest).toHaveBeenCalledWith('req-42');
    });
    expect(declineRequest).not.toHaveBeenCalled();
  });

  it('declines through the decline endpoint, not the accept one', async () => {
    getReceived.mockResolvedValue({
      requests: [request({ id: 'req-7' })],
      total: 1,
    });

    await renderWithQuery(<MatchRequestsScreen />);

    fireEvent.press(await screen.findByText('Decline'));

    await waitFor(() => {
      expect(declineRequest).toHaveBeenCalledWith('req-7');
    });
    expect(acceptRequest).not.toHaveBeenCalled();
  });

  it('shows the empty state when there are no received requests', async () => {
    getReceived.mockResolvedValue({ requests: [], total: 0 });

    await renderWithQuery(<MatchRequestsScreen />);

    expect(await screen.findByText('No requests yet')).toBeTruthy();
  });
});
