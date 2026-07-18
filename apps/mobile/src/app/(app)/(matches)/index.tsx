import { Text } from 'react-native';
import { Screen } from '../../../components/Screen';

/**
 * Match feed — Phase-0 stub, owned by Track B.
 *
 * Placeholder so the route tree is complete before Phase 1 starts: navigation,
 * tab wiring and deep links are Phase-0 concerns no track has to touch.
 * Track B replaces this body with the real feed.
 */
export default function MatchFeedScreen() {
  return (
    <Screen>
      <Text className="font-heading text-2xl text-primary">Matches</Text>
      <Text className="mt-2 text-muted">Coming in Sprint I · Track B</Text>
    </Screen>
  );
}
