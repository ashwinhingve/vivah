import { Text } from 'react-native';
import { Screen } from '../../../components/Screen';

/** Match requests (received + sent) — Phase-0 stub, owned by Track B. */
export default function MatchRequestsScreen() {
  return (
    <Screen>
      <Text className="font-heading text-2xl text-primary">Requests</Text>
      <Text className="mt-2 text-muted">Coming in Sprint I · Track B</Text>
    </Screen>
  );
}
