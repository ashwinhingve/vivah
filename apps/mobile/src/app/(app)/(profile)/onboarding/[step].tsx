import { Text } from 'react-native';
import { Screen } from '../../../../components/Screen';

/**
 * Onboarding wizard step — Phase-0 stub, owned by Track A.
 *
 * Route-per-step rather than one component holding step state internally: the
 * wizard is long (13 steps), users abandon it midway, and a real route means the
 * app can deep-link them back to exactly where they stopped after a cold start.
 */
export default function OnboardingStepScreen() {
  return (
    <Screen>
      <Text className="font-heading text-2xl text-primary">Set up your profile</Text>
      <Text className="mt-2 text-muted">Coming in Sprint I · Track A</Text>
    </Screen>
  );
}
