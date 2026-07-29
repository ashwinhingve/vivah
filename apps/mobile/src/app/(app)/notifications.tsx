import {
  View,
  FlatList,
  Text,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Bell, SlidersHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppHeader, HeaderIconButton } from '../../components/AppHeader';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { SkeletonRow } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { useNotifications } from '../../features/chat/useNotifications';
import { tokens, withAlpha } from '../../theme/tokens';
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
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { notifications, unreadCount, loading, error, retry, markRead, markAllRead } =
    useNotifications(unreadOnly, 50);

  const renderNotification = ({
    item,
    index,
  }: {
    item: NotificationRow;
    index: number;
  }) => {
    const category = notificationCategory(
      (item.data?.jobType as string) || item.type,
    );
    const meta = notificationMeta[category as NotificationCategory];

    const toneColor = getToneColor(meta.tone);

    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 30).duration(250)}>
        <Pressable
          onPress={() => !item.read && markRead(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          className={`px-4 py-3.5 active:bg-gold/5 ${
            index < notifications.length - 1 ? 'border-b border-gold/15' : ''
          } ${!item.read ? 'bg-teal/5' : ''}`}
        >
          <View className="flex-row gap-3 items-start">
            {/* Tone medallion */}
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: withAlpha(toneColor, '20') }}
            >
              <Bell size={18} color={toneColor} strokeWidth={1.75} />
            </View>

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
              <View className="w-2 h-2 rounded-full mt-2 bg-primary" />
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const headerRight = (
    <View className="flex-row items-center gap-3">
      {unreadCount > 0 && (
        <View
          className="min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-primary"
          accessibilityLabel={`${unreadCount} unread notifications`}
        >
          <Text className="text-on-primary text-2xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
      <HeaderIconButton
        icon={<SlidersHorizontal size={20} color={tokens.primary} strokeWidth={1.75} />}
        accessibilityLabel="Notification preferences"
        onPress={() => router.push('/(app)/notification-preferences')}
      />
    </View>
  );

  if (loading && notifications.length === 0) {
    return (
      <Screen>
        <AppHeader title="Notifications" showBack right={headerRight} />
        <Card className="p-0 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </Card>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader title="Notifications" showBack right={headerRight} />
        <ErrorState error={error} onRetry={retry} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppHeader title="Notifications" showBack right={headerRight} />

      <View className="mb-6">
        {/* Filter and actions */}
        <View className="flex-row gap-2 items-center justify-between">
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setUnreadOnly(!unreadOnly);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: unreadOnly }}
            className={`px-4 py-2 rounded-full border ${
              unreadOnly ? 'bg-primary border-primary' : 'bg-surface border-gold/40'
            }`}
          >
            <Text
              className={`font-semibold text-sm ${
                unreadOnly ? 'text-on-primary' : 'text-ink'
              }`}
            >
              Unread
            </Text>
          </Pressable>

          {unreadCount > 0 && (
            <Pressable
              onPress={markAllRead}
              accessibilityRole="button"
              hitSlop={8}
              className="min-h-11 justify-center"
            >
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
        <Card className="p-0 overflow-hidden mb-8">
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </Card>
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
