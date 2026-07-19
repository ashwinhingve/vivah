import {
  View,
  FlatList,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { LoadingState, ErrorState } from '../../../components/States';
import { useThread } from '../../../features/chat/useThread';
import { tokens } from '../../../theme/tokens';
import type { ChatMessage } from '@smartshaadi/types';
import { useState, useEffect, useRef } from 'react';

/**
 * Chat thread screen — Track C.
 * Displays messages in realtime with:
 * - Inverted FlatList (newest at bottom, auto-scroll)
 * - Message bubbles (own vs other)
 * - Read receipts, delivery state
 * - Composer with send
 * - Typing indicator
 * - Socket connection status
 */
export default function ChatThreadScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);

  const {
    messages,
    loading,
    error,
    socketStatus,
    retry,
    sendMessage,
    markMessagesRead,
  } = useThread(matchId || '');

  const flatListRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);

  // Mark unread messages as read when they come in
  useEffect(() => {
    const unreadMessageIds = messages
      .filter((m) => !m.readAt && m.senderId !== userIdRef.current)
      .map((m) => m._id);

    if (unreadMessageIds.length > 0) {
      markMessagesRead(unreadMessageIds);
    }
  }, [messages, markMessagesRead]);

  const handleSendMessage = async (): Promise<void> => {
    const trimmed = messageContent.trim();
    if (!trimmed || sending || socketStatus !== 'connected') return;

    setSending(true);
    setMessageContent('');
    sendMessage(trimmed);
    setSending(false);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.senderId === userIdRef.current;
    const isDeleted = !!item.deletedAt;

    return (
      <View
        className={`px-4 py-2 ${isOwn ? 'items-end' : 'items-start'}`}
      >
        <View
          className={`max-w-xs px-3 py-2 rounded-lg ${
            isOwn
              ? 'bg-primary rounded-br-none'
              : 'bg-gold/10 rounded-bl-none'
          }`}
        >
          <Text
            className={`text-base ${
              isOwn ? 'text-white' : 'text-ink'
            }`}
            selectable
          >
            {isDeleted ? '[deleted]' : item.content}
          </Text>

          {/* Timestamp and read status */}
          <View className="flex-row gap-1 mt-1 items-center">
            <Text
              className={`text-xs ${
                isOwn ? 'text-white/70' : 'text-muted'
              }`}
            >
              {formatTime(item.sentAt)}
            </Text>

            {isOwn && (
              <Text className="text-xs text-white/70">
                {item.readBy?.length > 0 ? '✓✓' : item.deliveredTo?.length > 0 ? '✓' : ''}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (!matchId) {
    return (
      <Screen>
        <Text className="text-destructive">Invalid chat ID</Text>
      </Screen>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <Screen>
        <LoadingState label="Loading chat..." />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={retry} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      {/* Connection status indicator */}
      {socketStatus !== 'connected' && (
        <View className="bg-warning px-4 py-2">
          <Text className="text-white text-xs text-center">
            {socketStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </Text>
        </View>
      )}

      {/* Messages list (inverted) */}
      <View className="flex-1">
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          inverted
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          contentContainerStyle={{ paddingVertical: 12 }}
          className="px-2"
        />
      </View>

      {/* Composer */}
      <View
        className="px-4 py-3 border-t border-gold/20 flex-row items-center gap-2"
        style={{ backgroundColor: tokens.surface }}
      >
        <TextInput
          value={messageContent}
          onChangeText={setMessageContent}
          placeholder="Type a message..."
          placeholderTextColor={tokens.muted}
          className="flex-1 h-10 px-3 rounded-lg border border-gold/40 text-ink"
          editable={!sending && socketStatus === 'connected'}
          maxLength={4000}
          multiline
        />

        <Pressable
          onPress={handleSendMessage}
          disabled={sending || !messageContent.trim() || socketStatus !== 'connected'}
          className="h-10 w-10 rounded-lg items-center justify-center"
          style={{
            backgroundColor:
              sending || !messageContent.trim() || socketStatus !== 'connected'
                ? tokens.gold + '40'
                : tokens.primary,
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color={tokens.surface} />
          ) : (
            <Text className="text-lg">→</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Format message timestamp for display.
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
