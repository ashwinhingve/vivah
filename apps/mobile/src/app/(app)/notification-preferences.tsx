import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { NotificationPreferences } from '@smartshaadi/api-client';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/States';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../features/notifications/hooks';

/** The channel switches shown, in order. `mutedTypes` is intentionally not
 *  surfaced here — per-type muting is an advanced feature for a later pass. */
type Channel = Exclude<keyof NotificationPreferences, 'mutedTypes'>;

const CHANNELS: { key: Channel; label: string; description: string }[] = [
  { key: 'push', label: 'Push notifications', description: 'Alerts on this device' },
  { key: 'inApp', label: 'In-app', description: 'Notifications inside the app' },
  { key: 'email', label: 'Email', description: 'Match and account updates by email' },
  { key: 'sms', label: 'SMS', description: 'Important alerts by text message' },
  {
    key: 'marketing',
    label: 'Offers & tips',
    description: 'Occasional promotions and product news',
  },
];

/**
 * Notification preferences — reached from the notification centre (⚙︎) and from
 * Settings. Each switch is an independent optimistic toggle: flip it and the
 * change persists immediately, rolling back only if the server rejects it.
 */
export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();

  const { data: prefs, error, isError, isLoading, refetch } =
    useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const backLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="mb-4"
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text className="text-sm" style={{ color: colors.teal }}>
        ← Back
      </Text>
    </Pressable>
  );

  if (isLoading) {
    return (
      <Screen>
        {backLink}
        <LoadingState label="Loading preferences…" />
      </Screen>
    );
  }

  if (isError || !prefs) {
    return (
      <Screen>
        {backLink}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {backLink}

      <Text className="font-heading text-2xl text-primary mb-2">
        Notification Preferences
      </Text>
      <Text className="text-sm text-muted mb-6">
        Choose how Smart Shaadi can reach you.
      </Text>

      {CHANNELS.map((channel) => {
        const value = prefs[channel.key];
        return (
          <View
            key={channel.key}
            className="bg-surface border border-gold/20 rounded-xl p-4 mb-4"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-ink mb-1">
                  {channel.label}
                </Text>
                <Text className="text-xs text-muted">{channel.description}</Text>
              </View>
              <Switch
                value={value}
                onValueChange={(next) => update.mutate({ [channel.key]: next })}
                trackColor={{ false: '#d9d9d9', true: colors.teal }}
                thumbColor={value ? colors.primary : '#f4f3f4'}
                testID={`pref-${channel.key}`}
                accessibilityLabel={channel.label}
              />
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
