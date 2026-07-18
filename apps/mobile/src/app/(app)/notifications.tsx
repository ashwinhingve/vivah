import {
  View,
  FlatList,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';
import { Button } from '../../components/Button';
import { useNotifications } from '../../features/chat/useNotifications';
import { tokens } from '../../theme/tokens';
import type { NotificationRow } from '@smartshaadi/types';
import {
  notificationCategory,
  notificationMeta,
  type NotificationCategory,
} from '@smartshaadi/types';
import { useState } from 'react';

/**
 * Notification centre screen — Track C.
 * Shows all notifications with ability to:
 * - Mark individual notifications as read
 * - Mark all as read
 * - Filter unread
 */
export default function NotificationsScreen() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { notifications, unreadCount, loading, error, retry, markRead, markAllRead } =
    useNotifications(unreadOnly, 50);

  const renderNotification = ({ item }: { item: NotificationRow }) => {
    const category = notificationCategory(
      (item.data?.jobType as string) || item.type,
    );
    const meta = notificationMeta[category as NotificationCategory];

    const toneColor = getToneColor(meta.tone);

    return (
      <Pressable
        onPress={() => !item.read && markRead(item.id)}
        className={`px-4 py-3 border-b border-gold/20 active:bg-gold/5 ${
          !item.read ? 'bg-teal/5' : ''
        }`}
      >
        <View className="flex-row gap-3 items-start">
          {/* Icon dot */}
          <View
            className="w-2 h-2 rounded-full mt-2"
            style={{ backgroundColor: toneColor }}
          />

          {/* Content */}
          <View className="flex-1">
            <Text
              className={`text-base font-semibold ${
                !item.read ? 'text-ink' : 'text-muted'
              }`}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            {item.body && (
              <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                {item.body}
              </Text>
            )}

            <Text className="text-xs text-muted mt-2">
              {formatTime(item.createdAt)}
            </Text>
          </View>

          {/* Unread indicator */}
          {!item.read && (
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tokens.primary }}
            />
          )}
        </View>
      </Pressable>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <Screen>
        <Text className="font-heading text-2xl text-primary mb-6">
          Notifications
        </Text>
        <LoadingState label="Loading notifications..." />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <Text className="font-heading text-2xl text-primary mb-6">
          Notifications
        </Text>
        <ErrorState error={error} onRetry={retry} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-heading text-2xl text-primary">
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View
              className="px-2 py-1 rounded-full"
              style={{ backgroundColor: tokens.primary }}
            >
              <Text className="text-white text-xs font-semibold">
                {unreadCount}
              </Text>
            </View>
          )}
        </View>

        {/* Filter and actions */}
        <View className="flex-row gap-2 justify-between">
          <Pressable
            onPress={() => setUnreadOnly(!unreadOnly)}
            className={`px-3 py-2 rounded-full ${
              unreadOnly ? 'bg-primary' : 'bg-gold/10'
            }`}
          >
            <Text
              className={
                unreadOnly
                  ? 'text-white font-semibold text-sm'
                  : 'text-primary font-semibold text-sm'
              }
            >
              Unread
            </Text>
          </Pressable>

          {unreadCount > 0 && (
            <Pressable onPress={markAllRead}>
              <Text className="text-teal font-semibold text-sm">
                Mark all read
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {notifications.length === 0 ? (
        <EmptyState
          title={
            unreadOnly ? 'No unread notifications' : 'No notifications'
          }
          message={
            unreadOnly
              ? "You're all caught up!"
              : "You'll see notifications here"
          }
        />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}
    </Screen>
  );
}

/**
 * Map notification tone to a hex color.
 */
function getToneColor(tone: string): string {
  switch (tone) {
    case 'primary':
      return tokens.primary;
    case 'teal':
      return tokens.teal;
    case 'gold':
      return tokens.gold;
    case 'success':
      return tokens.success;
    case 'destructive':
      return tokens.destructive;
    default:
      return tokens.muted;
  }
}

/**
 * Format a timestamp relative to now.
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
