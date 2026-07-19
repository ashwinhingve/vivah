import {
  View,
  FlatList,
  Text,
  Pressable,
  Image,
} from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';
import { useConversations } from '../../../features/chat/useConversations';
import { tokens } from '../../../theme/tokens';
import type { ConversationListItem } from '@smartshaadi/types';
import { useState } from 'react';

type FilterTab = 'all' | 'unread' | 'archived';

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Archived', value: 'archived' },
];

/**
 * Conversation list screen — Track C.
 * Shows all conversations with unread badges, last message preview, photos.
 * Supports filtering by all/unread/archived.
 */
export default function ConversationsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const { conversations, loading, error, retry } =
    useConversations(activeFilter);

  const renderConversation = ({ item }: { item: ConversationListItem }) => {
    const hasUnread = item.unreadCount > 0;

    return (
      <Link href={`/chat/${item.matchRequestId}`} asChild>
        <Pressable className="px-4 py-3 border-b border-gold/20 active:bg-gold/5">
          <View className="flex-row items-center gap-3">
            {/* Participant photo */}
            {item.other?.primaryPhotoKey ? (
              <Image
                source={{ uri: `https://example.com/photos/${item.other.primaryPhotoKey}` }}
                className="w-12 h-12 rounded-full bg-gold/10"
              />
            ) : (
              <View className="w-12 h-12 rounded-full bg-gold/20 items-center justify-center">
                <Text className="text-xs text-muted">
                  {item.other?.firstName?.[0] || '?'}
                </Text>
              </View>
            )}

            {/* Conversation info */}
            <View className="flex-1">
              <View className="flex-row justify-between items-start mb-1">
                <Text className="text-base font-semibold text-ink flex-1" numberOfLines={1}>
                  {item.other?.firstName || 'Unknown'}
                  {item.other?.age ? `, ${item.other.age}` : ''}
                </Text>
                <Text className="text-xs text-muted ml-2">
                  {formatTime(item.updatedAt)}
                </Text>
              </View>

              {/* Last message preview */}
              <Text className="text-sm text-muted" numberOfLines={1}>
                {item.lastMessage?.content || 'No messages yet'}
              </Text>
            </View>

            {/* Unread badge */}
            {hasUnread && (
              <View
                className="w-5 h-5 rounded-full items-center justify-center ml-2"
                style={{ backgroundColor: tokens.primary }}
              >
                <Text className="text-xs font-bold text-white">
                  {Math.min(item.unreadCount, 9)}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Link>
    );
  };

  if (loading && conversations.length === 0) {
    return (
      <Screen>
        <Text className="font-heading text-2xl text-primary mb-6">Chats</Text>
        <LoadingState label="Loading conversations..." />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <Text className="font-heading text-2xl text-primary mb-6">Chats</Text>
        <ErrorState error={error} onRetry={retry} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="mb-6">
        <Text className="font-heading text-2xl text-primary mb-4">Chats</Text>

        {/* Filter tabs */}
        <View className="flex-row gap-2">
          {FILTER_TABS.map((tab) => (
            <Pressable
              key={tab.value}
              onPress={() => setActiveFilter(tab.value)}
              className={`px-3 py-2 rounded-full ${
                activeFilter === tab.value ? 'bg-primary' : 'bg-gold/10'
              }`}
            >
              <Text
                className={
                  activeFilter === tab.value
                    ? 'text-white font-semibold text-sm'
                    : 'text-primary font-semibold text-sm'
                }
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {conversations.length === 0 ? (
        <EmptyState
          title={
            activeFilter === 'unread'
              ? 'No unread chats'
              : activeFilter === 'archived'
                ? 'No archived chats'
                : 'No chats yet'
          }
          message="Start matching to begin chatting"
          actionLabel="Browse matches"
          onAction={() => {
            // Navigate to matches — adjust route as needed
          }}
        />
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.matchRequestId}
          scrollEnabled={false}
          className="mt-4"
        />
      )}
    </Screen>
  );
}

/**
 * Format a timestamp relative to now.
 * Returns "just now", "5m", "2h", "Mon", "Jan 15", etc.
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
