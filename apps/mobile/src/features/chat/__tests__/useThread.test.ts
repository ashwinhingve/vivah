import { renderHook, waitFor, act } from '@testing-library/react-native';
import { createElement as h, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useThread } from '../useThread';
import { api } from '../../../lib/api';
import { chatSocket } from '../../../lib/socket';

jest.mock('../../../lib/api', () => ({
  api: {
    chat: {
      getConversation: jest.fn(),
    },
  },
  ApiRequestError: Error,
  NetworkError: Error,
}));

// State shared across mock socket operations (defined at module scope)
export const mockSocketState = {
  handlers: {} as Record<string, Array<(data: unknown) => void>>,
  statusHandlers: [] as Array<(status: unknown) => void>,
};

jest.mock('../../../lib/socket', () => {
  const handlers: Record<string, Array<(data: unknown) => void>> = {};
  const statusHandlers: Array<(status: unknown) => void> = [];

  return {
    chatSocket: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      joinRoom: jest.fn(),
      leaveRoom: jest.fn(),
      on: jest.fn((event: string, handler: (data: unknown) => void) => {
        if (!handlers[event]) {
          handlers[event] = [];
        }
        handlers[event].push(handler);
        // Store a reference at module level so tests can access it
        Object.assign(mockSocketState.handlers, handlers);
        return () => {
          const idx = handlers[event]?.indexOf(handler);
          if (idx !== undefined && idx > -1) {
            handlers[event]?.splice(idx, 1);
          }
          Object.assign(mockSocketState.handlers, handlers);
        };
      }),
      emit: jest.fn(),
      onStatusChange: jest.fn((handler: (status: unknown) => void) => {
        statusHandlers.push(handler);
        Object.assign(mockSocketState.statusHandlers, statusHandlers);
        return () => {
          const idx = statusHandlers.indexOf(handler);
          if (idx > -1) statusHandlers.splice(idx, 1);
          Object.assign(mockSocketState.statusHandlers, statusHandlers);
        };
      }),
      getStatus: jest.fn(() => 'connected'),
    },
  };
});

describe('useThread', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketState.handlers = {};
    mockSocketState.statusHandlers = [];
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  const createWrapper = () => ({ children }: { children: ReactNode }) =>
    h(QueryClientProvider, { client: queryClient, children });

  it('loads conversation on mount', async () => {
    const mockConversation = {
      matchRequestId: 'conv-1',
      participants: ['user1', 'user2'],
      messages: [
        {
          _id: 'msg-1',
          senderId: 'user1',
          content: 'Hello',
          contentHi: null,
          contentEn: null,
          type: 'TEXT' as const,
          photoKey: null,
          voiceKey: null,
          voiceDuration: null,
          sentAt: '2026-07-18T10:00:00Z',
          readAt: null,
          readBy: [],
          deliveredTo: [],
          reactions: [],
          replyTo: null,
          forwardedFrom: null,
          linkPreview: null,
          editedAt: null,
          deletedAt: null,
        },
      ],
      lastMessage: null,
      isActive: true,
      pinnedMessageIds: [],
      settings: {
        mutedUntil: null,
        archived: false,
        pinned: false,
        wallpaper: null,
      },
    };

    (api.chat.getConversation as jest.Mock).mockResolvedValue(
      mockConversation,
    );

    const { result } = await renderHook(() => useThread('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.conversation).toEqual(mockConversation);
    expect(result.current.messages).toHaveLength(1);
    expect(chatSocket.joinRoom).toHaveBeenCalledWith('conv-1');
  });

  it('sends messages over socket', async () => {
    const mockConversation = {
      matchRequestId: 'conv-1',
      participants: ['user1', 'user2'],
      messages: [],
      lastMessage: null,
      isActive: true,
      pinnedMessageIds: [],
      settings: {
        mutedUntil: null,
        archived: false,
        pinned: false,
        wallpaper: null,
      },
    };

    (api.chat.getConversation as jest.Mock).mockResolvedValue(
      mockConversation,
    );

    const { result } = await renderHook(() => useThread('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.sendMessage('Test message');
    });

    expect(chatSocket.emit).toHaveBeenCalledWith('send_message', {
      matchRequestId: 'conv-1',
      content: 'Test message',
      type: 'TEXT',
    });
  });

  it('receives messages from socket', async () => {
    const mockConversation = {
      matchRequestId: 'conv-1',
      participants: ['user1', 'user2'],
      messages: [],
      lastMessage: null,
      isActive: true,
      pinnedMessageIds: [],
      settings: {
        mutedUntil: null,
        archived: false,
        pinned: false,
        wallpaper: null,
      },
    };

    (api.chat.getConversation as jest.Mock).mockResolvedValue(
      mockConversation,
    );

    const { result } = await renderHook(() => useThread('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate incoming message
    const incomingMessage = {
      _id: 'msg-2',
      senderId: 'user2',
      content: 'Response',
      contentHi: null,
      contentEn: null,
      type: 'TEXT' as const,
      photoKey: null,
      voiceKey: null,
      voiceDuration: null,
      sentAt: '2026-07-18T10:05:00Z',
      readAt: null,
      readBy: [],
      deliveredTo: [],
      reactions: [],
      replyTo: null,
      forwardedFrom: null,
      linkPreview: null,
      editedAt: null,
      deletedAt: null,
    };

    act(() => {
      mockSocketState.handlers['message_received']?.[0]?.(incomingMessage);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0]).toEqual(incomingMessage);
  });

  it('marks messages as read', async () => {
    const mockConversation = {
      matchRequestId: 'conv-1',
      participants: ['user1', 'user2'],
      messages: [],
      lastMessage: null,
      isActive: true,
      pinnedMessageIds: [],
      settings: {
        mutedUntil: null,
        archived: false,
        pinned: false,
        wallpaper: null,
      },
    };

    (api.chat.getConversation as jest.Mock).mockResolvedValue(
      mockConversation,
    );

    const { result } = await renderHook(() => useThread('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.markMessagesRead(['msg-1', 'msg-2']);
    });

    expect(chatSocket.emit).toHaveBeenCalledWith('mark_read', {
      matchRequestId: 'conv-1',
      messageIds: ['msg-1', 'msg-2'],
    });
  });

  it('leaves room on unmount', async () => {
    const mockConversation = {
      matchRequestId: 'conv-1',
      participants: ['user1', 'user2'],
      messages: [],
      lastMessage: null,
      isActive: true,
      pinnedMessageIds: [],
      settings: {
        mutedUntil: null,
        archived: false,
        pinned: false,
        wallpaper: null,
      },
    };

    (api.chat.getConversation as jest.Mock).mockResolvedValue(
      mockConversation,
    );

    const { unmount } = await renderHook(() => useThread('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(chatSocket.joinRoom).toHaveBeenCalled();
    });

    unmount();

    expect(chatSocket.leaveRoom).toHaveBeenCalledWith('conv-1');
  });
});
