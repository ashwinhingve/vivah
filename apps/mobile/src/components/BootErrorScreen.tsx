import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';

/**
 * Full-screen fallback shown when the app cannot establish a session at boot —
 * the safety net for a wedged session hook or an unreachable server, so a cold
 * start can never sit on an endless spinner. Copy is connection-oriented (the
 * raw fetch failures that reach here are timeouts / network errors, not typed
 * API errors), with a single Retry that re-runs the direct session fetch.
 */
export function BootErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-heading text-2xl text-primary text-center">
          {"Couldn't connect"}
        </Text>
        <Text className="mt-3 text-center text-muted">
          {"We couldn't reach Smart Shaadi. Check your internet connection and try again."}
        </Text>
        <View className="mt-8 w-full">
          <Button title="Try again" onPress={onRetry} />
        </View>
      </View>
    </SafeAreaView>
  );
}
