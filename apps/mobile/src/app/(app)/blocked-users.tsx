import { useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useThemeColors } from '../../hooks/useThemeColors';
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
  const router = useRouter();
  const { colors } = useThemeColors();

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
  const backLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to settings"
      onPress={() => router.back()}
      className="mb-4"
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text className="text-sm" style={{ color: colors.teal }}>
        ← Settings
      </Text>
    </Pressable>
  );

  if (isLoading) {
    return (
      <Screen>
        {backLink}
        <LoadingState label="Loading blocked users…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        {backLink}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const blocks = data?.blocks ?? [];

  if (blocks.length === 0) {
    return (
      <Screen>
        {backLink}
        <EmptyState
          title="No blocked users"
          message="Profiles you block will appear here. You can unblock them at any time."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {backLink}

      <Text className="font-heading text-2xl text-primary mb-6">
        Blocked Users
      </Text>

      {blocks.map((block) => (
        <View
          key={block.blockId}
          className="bg-surface border border-gold/20 rounded-xl p-4 mb-3"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
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
          </View>
        </View>
      ))}
    </Screen>
  );
}
