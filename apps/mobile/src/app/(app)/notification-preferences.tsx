import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NotificationPreferences } from '@smartshaadi/api-client';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { SwitchRow } from '../../components/SwitchRow';
import { Skeleton } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
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

const HEADER = (
  <AppHeader
    title="Notification Preferences"
    subtitle="Choose how Smart Shaadi can reach you."
    showBack
  />
);

/**
 * Notification preferences — reached from the notification centre (⚙︎) and from
 * Settings. Each switch is an independent optimistic toggle: flip it and the
 * change persists immediately, rolling back only if the server rejects it.
 */
export default function NotificationPreferencesScreen() {
  const { data: prefs, error, isError, isLoading, refetch } =
    useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  if (isLoading) {
    return (
      <Screen>
        {HEADER}
        <Card className="p-0 overflow-hidden">
          {CHANNELS.map((channel, index) => (
            <View
              key={channel.key}
              className={`flex-row items-center justify-between gap-4 px-4 py-3.5 ${
                index < CHANNELS.length - 1 ? 'border-b border-gold/15' : ''
              }`}
            >
              <View className="flex-1 gap-2">
                <Skeleton height={16} width="45%" radius={6} />
                <Skeleton height={12} width="70%" radius={6} />
              </View>
              <Skeleton height={28} width={48} radius={14} />
            </View>
          ))}
        </Card>
      </Screen>
    );
  }

  if (isError || !prefs) {
    return (
      <Screen>
        {HEADER}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {HEADER}

      <Animated.View entering={FadeInUp.duration(300)}>
        <Card className="p-0 overflow-hidden">
          {CHANNELS.map((channel, index) => (
            <SwitchRow
              key={channel.key}
              label={channel.label}
              description={channel.description}
              value={prefs[channel.key]}
              onValueChange={(next) => update.mutate({ [channel.key]: next })}
              divider={index < CHANNELS.length - 1}
              testID={`pref-${channel.key}`}
            />
          ))}
        </Card>
      </Animated.View>
    </Screen>
  );
}
