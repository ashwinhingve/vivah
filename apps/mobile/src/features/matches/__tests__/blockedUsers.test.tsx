import { screen } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
    api: {
      matchmaking: { getBlockedUsers: jest.fn(), unblockProfile: jest.fn() },
    },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import BlockedUsersScreen from '../../../app/(app)/blocked-users';

const getBlockedUsers = api.matchmaking.getBlockedUsers as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('BlockedUsersScreen', () => {
  it('lists blocked users with an unblock action', async () => {
    getBlockedUsers.mockResolvedValue({
      blocks: [
        {
          blockId: 'blk-1',
          profileId: 'p-9',
          name: 'Anonymous member',
          primaryPhotoKey: null,
          reason: null,
          blockedAt: '2026-07-10T00:00:00.000Z',
        },
      ],
      total: 1,
    });

    await renderScreen(<BlockedUsersScreen />);

    expect(await screen.findByText('Anonymous member')).toBeTruthy();
    expect(screen.getByText('Unblock')).toBeTruthy();
  });

  it('shows an empty state when nobody is blocked', async () => {
    getBlockedUsers.mockResolvedValue({ blocks: [], total: 0 });

    await renderScreen(<BlockedUsersScreen />);

    expect(await screen.findByText('No blocked users')).toBeTruthy();
  });
});
