import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('../../../lib/api', () => ({
  api: {
    users: {
      getNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markNotificationRead: jest.fn(),
      markAllNotificationsRead: jest.fn(),
    },
  },
  ApiRequestError: class extends Error {},
  NetworkError: class extends Error {},
}));

import { api } from '../../../lib/api';
import NotificationsScreen from '../../../app/(app)/notifications';

const getNotifications = api.users.getNotifications as jest.Mock;
const getUnreadCount = api.users.getUnreadCount as jest.Mock;
const markRead = api.users.markNotificationRead as jest.Mock;
const markAllRead = api.users.markAllNotificationsRead as jest.Mock;

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'MESSAGE',
    title: 'New message from Asha',
    body: 'Asha sent you a message',
    data: null,
    read: false,
    sentVia: null,
    createdAt: '2026-07-18T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  markRead.mockResolvedValue(undefined);
  markAllRead.mockResolvedValue(undefined);
});

/**
 * Driven through the screen rather than renderHook — see src/test-utils/render.tsx.
 * These assert on what a user would actually see, which is also what makes them
 * fail when the screen is gutted.
 */
describe('NotificationsScreen', () => {
  it('fetches and renders notifications from the API', async () => {
    getNotifications.mockResolvedValue([notification()]);
    getUnreadCount.mockResolvedValue({ count: 1 });

    await renderScreen(<NotificationsScreen />);

    // Title and body could only have come from the mocked response.
    expect(await screen.findByText('New message from Asha')).toBeTruthy();
    expect(screen.getByText('Asha sent you a message')).toBeTruthy();
    expect(getNotifications).toHaveBeenCalled();
  });

  it('shows the unread count badge from the API', async () => {
    getNotifications.mockResolvedValue([notification()]);
    getUnreadCount.mockResolvedValue({ count: 7 });

    await renderScreen(<NotificationsScreen />);

    expect(await screen.findByText('7')).toBeTruthy();
  });

  it('marks a notification read through the API when tapped', async () => {
    getNotifications.mockResolvedValue([notification({ id: 'notif-42' })]);
    getUnreadCount.mockResolvedValue({ count: 1 });

    await renderScreen(<NotificationsScreen />);

    fireEvent.press(await screen.findByText('New message from Asha'));

    // The id matters: marking the wrong row read silently loses a notification.
    await waitFor(() => {
      expect(markRead).toHaveBeenCalledWith('notif-42');
    });
  });

  it('does not re-mark an already-read notification', async () => {
    getNotifications.mockResolvedValue([
      notification({ id: 'notif-9', read: true }),
    ]);
    getUnreadCount.mockResolvedValue({ count: 0 });

    await renderScreen(<NotificationsScreen />);

    fireEvent.press(await screen.findByText('New message from Asha'));

    // Guards the `!item.read && markRead(...)` condition on the row press.
    await waitFor(() => {
      expect(getNotifications).toHaveBeenCalled();
    });
    expect(markRead).not.toHaveBeenCalled();
  });

  it('marks all read through the API', async () => {
    getNotifications.mockResolvedValue([notification()]);
    getUnreadCount.mockResolvedValue({ count: 2 });

    await renderScreen(<NotificationsScreen />);

    fireEvent.press(await screen.findByText('Mark all read'));

    await waitFor(() => {
      expect(markAllRead).toHaveBeenCalled();
    });
  });

  it('renders the empty state when there are no notifications', async () => {
    getNotifications.mockResolvedValue([]);
    getUnreadCount.mockResolvedValue({ count: 0 });

    await renderScreen(<NotificationsScreen />);

    expect(await screen.findByText('No notifications')).toBeTruthy();
  });

  it('renders an error state when the fetch fails', async () => {
    const failure = new Error('API Error');
    getNotifications.mockRejectedValue(failure);
    getUnreadCount.mockRejectedValue(failure);

    await renderScreen(<NotificationsScreen />);

    // describeError falls through to its generic branch for a plain Error.
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
  });
});
