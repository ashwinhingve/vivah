import { useCallback } from 'react';
import { Alert, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AppHeader } from '../../components/AppHeader';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Avatar } from '../../components/Avatar';
import { SkeletonRow } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { formatDate } from '../../lib/format';
import {
  useBlockedUsers,
  useUnblockProfile,
} from '../../features/matches/hooks';

/**
 * Blocked users — reached from Settings → Privacy & Safety → Manage Blocked
 * Users. Lists everyone the signed-in user has blocked and lets them unblock,
 * which reopens that profile to matching. Unblocking is confirmed first: it is
 * the opposite of a safety action, so a stray tap should not undo one silently.
 */
export default function BlockedUsersScreen() {
  const { data, error, isError, isLoading, refetch } = useBlockedUsers();
  const unblock = useUnblockProfile();

  const handleUnblock = useCallback(
    (profileId: string, name: string | null) => {
      Alert.alert(
        'Unblock this person?',
        `${name ?? 'This profile'} will be able to appear in your matches again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            style: 'destructive',
            onPress: () => unblock.mutate(profileId),
          },
        ],
      );
    },
    [unblock],
  );

  // Rendered in every state — this is a pushed route with no tab bar behind it.
  const header = <AppHeader title="Blocked Users" showBack />;

  if (isLoading) {
    return (
      <Screen>
        {header}
        <Card className="p-0 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </Card>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        {header}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const blocks = data?.blocks ?? [];

  if (blocks.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          title="No blocked users"
          message="Profiles you block will appear here. You can unblock them at any time."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {header}

      <Card className="p-0 overflow-hidden">
        {blocks.map((block, index) => (
          <Animated.View
            key={block.blockId}
            entering={FadeInUp.delay(Math.min(index, 8) * 40).duration(250)}
            className={`flex-row items-center gap-3 px-4 py-3.5 ${
              index < blocks.length - 1 ? 'border-b border-gold/15' : ''
            }`}
          >
            <Avatar uri={null} name={block.name ?? 'Smart Shaadi member'} size="md" />

            <View className="flex-1 pr-2">
              <Text className="font-semibold text-ink">
                {block.name ?? 'Smart Shaadi member'}
              </Text>
              {formatDate(block.blockedAt) ? (
                <Text className="text-xs text-muted mt-1">
                  Blocked on {formatDate(block.blockedAt)}
                </Text>
              ) : null}
              {block.reason ? (
                <Text className="text-xs text-muted mt-1">
                  Reason: {block.reason}
                </Text>
              ) : null}
            </View>

            <View className="w-28">
              <Button
                title="Unblock"
                variant="secondary"
                loading={
                  unblock.isPending && unblock.variables === block.profileId
                }
                onPress={() => handleUnblock(block.profileId, block.name)}
                accessibilityLabel={`Unblock ${block.name ?? 'this member'}`}
              />
            </View>
          </Animated.View>
        ))}
      </Card>
    </Screen>
  );
}
