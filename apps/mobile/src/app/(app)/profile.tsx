import { Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';

/**
 * Profile screen — Phase-1 placeholder.
 * Demonstrates the component kit: Screen (safe area + bg), Button (disabled state).
 * Owned by Teammate A. Teammate B's screens (home) do not import these components.
 */
export default function ProfileScreen() {
  return (
    <Screen>
      <Text className="text-ink font-bold text-2xl mb-4">
        {/* TODO: Playfair Display heading font (Teammate/Phase 7) */}
        Profile
      </Text>
      <Text className="text-muted text-base leading-6 mb-6">
        Coming soon — this is a pre-launch scaffold.
      </Text>
      <Button title="Edit Profile" disabled />
    </Screen>
  );
}
