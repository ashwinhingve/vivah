import { fireEvent, screen, waitFor } from '@testing-library/react-native';
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
      users: {
        getNotificationPreferences: jest.fn(),
        updateNotificationPreferences: jest.fn(),
      },
    },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import NotificationPreferencesScreen from '../../../app/(app)/notification-preferences';

const getPrefs = api.users.getNotificationPreferences as jest.Mock;
const updatePrefs = api.users.updateNotificationPreferences as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  getPrefs.mockResolvedValue({
    push: true,
    sms: true,
    email: true,
    inApp: true,
    marketing: false,
    mutedTypes: [],
  });
  updatePrefs.mockResolvedValue({ ok: true });
});

describe('NotificationPreferencesScreen', () => {
  it('renders a switch per channel', async () => {
    await renderScreen(<NotificationPreferencesScreen />);

    expect(await screen.findByText('Push notifications')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByTestId('pref-push')).toBeTruthy();
    expect(screen.getByTestId('pref-marketing')).toBeTruthy();
  });

  it('persists a toggle change for just that channel', async () => {
    await renderScreen(<NotificationPreferencesScreen />);

    const marketing = await screen.findByTestId('pref-marketing');
    fireEvent(marketing, 'valueChange', true);

    await waitFor(() =>
      expect(updatePrefs).toHaveBeenCalledWith({ marketing: true }),
    );
  });
});
