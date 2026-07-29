import {
  View,
  FlatList,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Check, CheckCheck, ChevronLeft, Send } from 'lucide-react-native';
import { Screen } from '../../../components/Screen';
import { Avatar } from '../../../components/Avatar';
import { SkeletonRow } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import { useThread } from '../../../features/chat/useThread';
import { useSession } from '../../../hooks/useSession';
import { tokens, withAlpha } from '../../../theme/tokens';
import { MEDIA_BASE_URL } from '../../../lib/env';
import type { ChatMessage } from '@smartshaadi/types';
import { useState, useEffect, useRef } from 'react';

/**
 * Chat thread screen — Track C.
 * Displays messages in realtime with:
 * - Slim identity header (avatar + name from route params, connection state)
 * - Inverted FlatList (newest at bottom, auto-scroll)
 * - Brand message bubbles (own = burgundy, other = surface + gold hairline)
 * - Day separator chips between calendar days
 * - Read receipts as check icons, delivery state
 * - Rounded composer with circular send button
 */
export default function ChatThreadScreen() {
  const { matchId, name, photoKey } = useLocalSearchParams<{
    matchId: string;
    name?: string;
    photoKey?: string;
  }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);

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

  const participantName = name || 'Chat';

  // The signed-in user's id, used to tell own messages from the other party's.
  // Read reactively from the session (not stashed in a ref) so that when the
  // session resolves after first paint, the list re-renders and bubbles align
  // correctly — a ref update alone wouldn't trigger that re-render.
  const currentUserId = session?.user?.id ?? null;

  // Mark unread messages as read when they come in
  useEffect(() => {
    const unreadMessageIds = messages
      .filter((m) => !m.readAt && m.senderId !== currentUserId)
      .map((m) => m._id);

    if (unreadMessageIds.length > 0) {
      markMessagesRead(unreadMessageIds);
    }
  }, [messages, markMessagesRead, currentUserId]);

  const handleSendMessage = async (): Promise<void> => {
    const trimmed = messageContent.trim();
    if (!trimmed || sending || socketStatus !== 'connected') return;

    setSending(true);
    setMessageContent('');
    sendMessage(trimmed);
    setSending(false);
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = item.senderId === currentUserId;
    const isDeleted = !!item.deletedAt;
    // Inverted list: index + 1 is the OLDER neighbour. When the calendar day
    // changes against it, this message opens a new day — render a chip above.
    const older = messages[index + 1];
    const showDayChip = !older || dayKey(older.sentAt) !== dayKey(item.sentAt);

    return (
      <View className="px-4 py-1">
        {showDayChip && (
          <View className="items-center py-3">
            <View className="rounded-full bg-gold/10 px-3 py-1">
              <Text className="text-2xs font-semibold uppercase text-gold-muted">
                {formatDay(item.sentAt)}
              </Text>
            </View>
          </View>
        )}
        <Animated.View
          entering={FadeInUp.duration(200)}
          className={isOwn ? 'items-end' : 'items-start'}
        >
          <View
            className={`px-3.5 py-2.5 rounded-2xl ${
              isOwn
                ? 'bg-primary rounded-br-md'
                : 'bg-surface border border-gold/30 rounded-bl-md'
            }`}
            style={{ maxWidth: '80%' }}
          >
            <Text
              className={
                isDeleted
                  ? `text-base italic ${isOwn ? 'text-white/70' : 'text-muted'}`
                  : `text-base ${isOwn ? 'text-white' : 'text-ink'}`
              }
              selectable
            >
              {isDeleted ? 'Message deleted' : item.content}
            </Text>

            {/* Timestamp and read status */}
            <View className="flex-row gap-1 mt-1 items-center self-end">
              <Text className={`text-xs ${isOwn ? 'text-white/70' : 'text-muted'}`}>
                {formatTime(item.sentAt)}
              </Text>

              {isOwn &&
                (item.readBy?.length > 0 ? (
                  <CheckCheck size={14} color={tokens.peach} />
                ) : item.deliveredTo?.length > 0 ? (
                  <Check size={14} color="rgba(255,255,255,0.7)" />
                ) : null)}
            </View>
          </View>
        </Animated.View>
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

  const header = (
    <View className="flex-row items-center gap-3 border-b border-gold/20 bg-surface px-4 py-2.5">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={4}
        className="h-10 w-10 items-center justify-center rounded-full active:bg-gold/10"
      >
        <ChevronLeft size={24} color={tokens.primary} />
      </Pressable>
      <Avatar
        uri={photoKey ? `${MEDIA_BASE_URL}/${photoKey}` : undefined}
        name={participantName}
        size="sm"
      />
      <View className="flex-1">
        <Text className="font-heading text-lg text-primary" numberOfLines={1}>
          {participantName}
        </Text>
        {socketStatus !== 'connected' && (
          <Text className="text-xs font-medium text-warning">
            {socketStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading && messages.length === 0) {
    return (
      <Screen scroll={false} contentClassName="px-0 py-0">
        {header}
        <View className="pt-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll={false} contentClassName="px-0 py-0">
        {header}
        <View className="flex-1 px-6">
          <ErrorState error={error} onRetry={retry} />
        </View>
      </Screen>
    );
  }

  const canSend = !sending && !!messageContent.trim() && socketStatus === 'connected';

  return (
    <Screen scroll={false} keyboardAvoiding contentClassName="px-0 py-0">
      {header}

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
        />
      </View>

      {/* Composer */}
      <View className="flex-row items-end gap-2 border-t border-gold/20 bg-surface px-4 py-3">
        <TextInput
          value={messageContent}
          onChangeText={setMessageContent}
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
          placeholder="Type a message..."
          placeholderTextColor={tokens.muted}
          className={`flex-1 min-h-11 max-h-28 rounded-3xl border bg-background px-4 py-2.5 text-base text-ink ${
            composerFocused ? 'border-teal' : 'border-gold/40'
          }`}
          editable={!sending && socketStatus === 'connected'}
          maxLength={4000}
          multiline
        />

        <Pressable
          onPress={handleSendMessage}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-80"
          style={{
            backgroundColor: canSend ? tokens.primary : withAlpha(tokens.gold, '40'),
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color={tokens.onPrimary} />
          ) : (
            <Send size={18} color={tokens.onPrimary} style={{ marginLeft: -2, marginTop: 1 }} />
          )}
        </Pressable>
      </View>
    </Screen>
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

/** Calendar-day key for day-separator comparison. */
function dayKey(isoString: string): string {
  return new Date(isoString).toDateString();
}

/** "Today", "Yesterday", or "Mon, Jan 15" for the day separator chip. */
function formatDay(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
