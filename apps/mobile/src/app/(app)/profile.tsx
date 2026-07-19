import { Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';

/**
 * Profile screen — pre-launch placeholder.
 * Uses the component kit: Screen (safe area + bg), Button (disabled state).
 */
export default function ProfileScreen() {
  return (
    <Screen>
      <Text className="text-primary font-heading text-2xl mb-4">Profile</Text>
      <Text className="text-muted text-base leading-6 mb-6">
        Coming soon — this is a pre-launch scaffold.
      </Text>
      <Button title="Edit Profile" disabled />
    </Screen>
  );
}
