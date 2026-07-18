import { Text } from 'react-native';
import { Screen } from '../../components/Screen';

/** "More" hub — Phase-0 stub, owned by Track A. Links to settings, billing, notifications. */
export default function MoreScreen() {
  return (
    <Screen>
      <Text className="font-heading text-2xl text-primary">More</Text>
      <Text className="mt-2 text-muted">Coming in Sprint I · Track A</Text>
    </Screen>
  );
}
