import '../global.css';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Root layout — Phase-1 implementation.
 * Wraps the entire app tree in GestureHandlerRootView and SafeAreaProvider,
 * then renders the Stack for group-based file routing.
 * Groups: (auth) — phone/verify flow; (app) — tab-based home/profile.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
