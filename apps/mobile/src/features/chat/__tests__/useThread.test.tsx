import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useFocusEffect: jest.fn(),
}));

/**
 * Socket handlers registered by the screen, captured so a test can fire a
 * server event by hand. `on` MUST return an unsubscribe function — the hook
 * calls every returned value on unmount, and returning undefined throws during
 * teardown, which surfaces as an unrelated-looking failure in the NEXT test.
 */
const mockSocketHandlers = new Map<string, (payload: unknown) => void>();

jest.mock('../../../lib/socket', () => ({
  chatSocket: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    emit: jest.fn(),
    getStatus: jest.fn(() => 'connected'),
    // Invoke the listener immediately with 'connected'. The screen refuses to
    // send while socketStatus !== 'connected', so a listener that never fires
    // leaves the composer permanently inert and the send test asserts nothing.
    onStatusChange: jest.fn((cb: (status: string) => void) => {
      cb('connected');
      return () => undefined;
    }),
    on: jest.fn((event: string, handler: (payload: unknown) => void) => {
      mockSocketHandlers.set(event, handler);
      return () => mockSocketHandlers.delete(event);
    }),
  },
}));

jest.mock('../../../lib/api', () => ({
  api: {
    chat: {
      getConversation: jest.fn(),
      getMessages: jest.fn(),
    },
  },
  ApiRequestError: class extends Error {},
  NetworkError: class extends Error {},
}));

import { api } from '../../../lib/api';
import { chatSocket } from '../../../lib/socket';
import ChatThreadScreen from '../../../app/(app)/(chat)/[matchId]';

const getConversation = api.chat.getConversation as jest.Mock;

/**
 * Mirrors ChatMessage in @smartshaadi/types — note `_id` and `sentAt`, not
 * `id`/`createdAt`. The shape is MongoDB-native because chat messages live in
 * Mongo, and getting it wrong here produced an emit of
 * `messageIds: [undefined]` that looked like a bug in the screen but was a bug
 * in the fixture.
 */
function message(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'msg-1',
    senderId: 'other-user',
    content: 'Namaste, how are you?',
    contentHi: null,
    contentEn: null,
    type: 'TEXT',
    photoKey: null,
    voiceKey: null,
    voiceDuration: null,
    sentAt: '2026-07-18T10:00:00Z',
    readAt: null,
    readBy: [],
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSocketHandlers.clear();
  getConversation.mockResolvedValue({
    matchId: 'match-1',
    messages: [message()],
    participants: [],
  });
});

describe('ChatThreadScreen', () => {
  it('loads the conversation and renders its messages', async () => {
    await renderScreen(<ChatThreadScreen />);

    expect(await screen.findByText('Namaste, how are you?')).toBeTruthy();
    expect(getConversation).toHaveBeenCalledWith('match-1');
  });

  it('joins the socket room for this match', async () => {
    await renderScreen(<ChatThreadScreen />);

    await waitFor(() => {
      expect(chatSocket.joinRoom).toHaveBeenCalledWith('match-1');
    });
  });

  it('appends an incoming socket message to the thread', async () => {
    await renderScreen(<ChatThreadScreen />);
    await screen.findByText('Namaste, how are you?');

    // Fire the server event by invoking the handler the screen registered.
    // This is the single most valuable test here: it proves realtime delivery
    // reaches the rendered thread, not merely that a listener was attached.
    const handler = mockSocketHandlers.get('message_received');
    expect(handler).toBeDefined();

    handler?.(message({ _id: 'msg-2', content: 'I am well, thank you' }));

    expect(await screen.findByText('I am well, thank you')).toBeTruthy();
    // The original message must survive the append.
    expect(screen.getByText('Namaste, how are you?')).toBeTruthy();
  });

  it('emits send_message when the composer is submitted', async () => {
    await renderScreen(<ChatThreadScreen />);
    await screen.findByText('Namaste, how are you?');

    // Awaited: fireEvent is async in RNTL v14, like render/unmount. Without the
    // await the typed text has not committed, so the send Pressable is still
    // `disabled` on the next line and the press is silently swallowed.
    await fireEvent.changeText(
      screen.getByPlaceholderText('Type a message...'),
      'Bahut accha',
    );
    await fireEvent.press(screen.getByText('→'));

    await waitFor(() => {
      // Payload key is `matchRequestId`, matching the server's socket contract
      // in apps/api/src/chat/socket — not `matchId`, which is the route param.
      expect(chatSocket.emit).toHaveBeenCalledWith(
        'send_message',
        expect.objectContaining({
          matchRequestId: 'match-1',
          content: 'Bahut accha',
        }),
      );
    });
  });

  it('leaves the socket room on unmount', async () => {
    const { unmount } = await renderScreen(<ChatThreadScreen />);

    await waitFor(() => {
      expect(chatSocket.joinRoom).toHaveBeenCalled();
    });

    await unmount();

    // Without this the server keeps the socket in the room after the user has
    // navigated away, and messages for a closed thread keep arriving.
    expect(chatSocket.leaveRoom).toHaveBeenCalledWith('match-1');
  });

  it('renders an error state when the conversation fails to load', async () => {
    getConversation.mockRejectedValue(new Error('boom'));

    await renderScreen(<ChatThreadScreen />);

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
  });
});
