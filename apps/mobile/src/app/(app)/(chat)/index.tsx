import {
  View,
  FlatList,
  Text,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Screen } from '../../../components/Screen';
import { AppHeader } from '../../../components/AppHeader';
import { Avatar } from '../../../components/Avatar';
import { SkeletonRow } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import { useConversations } from '../../../features/chat/useConversations';
import { MEDIA_BASE_URL } from '../../../lib/env';
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
 * Avatar-led rows with unread emphasis (bold name, burgundy count pill),
 * last message preview, and filter pills. Supports all/unread/archived.
 */
export default function ConversationsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const { conversations, loading, error, retry } =
    useConversations(activeFilter);

  const renderConversation = ({ item, index }: { item: ConversationListItem; index: number }) => {
    const hasUnread = item.unreadCount > 0;
    const name = item.other?.firstName || 'Unknown';

    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 40).duration(300)}>
        <Link
          href={{
            pathname: '/(app)/(chat)/[matchId]',
            params: {
              matchId: item.matchRequestId,
              name,
              photoKey: item.other?.primaryPhotoKey ?? '',
            },
          }}
          asChild
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${name}${hasUnread ? `, ${item.unreadCount} unread` : ''}`}
            className="px-1 py-3 border-b border-gold/15 active:bg-gold/5"
          >
            <View className="flex-row items-center gap-3">
              {/* Participant photo (initials fallback) */}
              <Avatar
                uri={
                  item.other?.primaryPhotoKey
                    ? `${MEDIA_BASE_URL}/${item.other.primaryPhotoKey}`
                    : undefined
                }
                name={name}
                size="md"
              />

              {/* Conversation info */}
              <View className="flex-1">
                <View className="flex-row justify-between items-start mb-0.5">
                  <Text
                    className={`text-base flex-1 ${
                      hasUnread ? 'font-bold text-primary' : 'font-semibold text-ink'
                    }`}
                    numberOfLines={1}
                  >
                    {name}
                    {item.other?.age ? `, ${item.other.age}` : ''}
                  </Text>
                  <Text
                    className={`text-xs ml-2 ${hasUnread ? 'font-semibold text-primary' : 'text-muted'}`}
                  >
                    {formatTime(item.updatedAt)}
                  </Text>
                </View>

                {/* Last message preview */}
                <Text
                  className={`text-sm ${hasUnread ? 'font-medium text-ink' : 'text-muted'}`}
                  numberOfLines={1}
                >
                  {item.lastMessage?.content || 'No messages yet'}
                </Text>
              </View>

              {/* Unread badge */}
              {hasUnread && (
                <View className="ml-1 min-w-5 h-5 px-1 rounded-full bg-primary items-center justify-center">
                  <Text className="text-xs font-bold text-on-primary">
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </Link>
      </Animated.View>
    );
  };

  const filterPills = (
    <View className="flex-row gap-2">
      {FILTER_TABS.map((tab) => {
        const isActive = activeFilter === tab.value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => setActiveFilter(tab.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className={`min-h-9 items-center justify-center px-4 py-1.5 rounded-full ${
              isActive ? 'bg-primary' : 'bg-gold/10'
            }`}
          >
            <Text
              className={`font-semibold text-sm ${isActive ? 'text-on-primary' : 'text-gold-muted'}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (loading && conversations.length === 0) {
    return (
      <Screen>
        <AppHeader title="Chats" />
        {filterPills}
        <View className="mt-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader title="Chats" />
        <ErrorState error={error} onRetry={retry} />
      </Screen>
    );
  }

  return (
    <Screen tabBarInset>
      <View className="mb-4">
        <AppHeader title="Chats" className="mb-4" />
        {filterPills}
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
          onAction={() => router.replace('/(app)/(matches)')}
        />
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.matchRequestId}
          scrollEnabled={false}
          className="mt-2"
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
