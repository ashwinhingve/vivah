import '../global.css';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { queryClient } from '../lib/queryClient';

/**
 * Root layout.
 * Wraps the entire app tree in GestureHandlerRootView, SafeAreaProvider and the
 * React Query provider, then renders the Stack for group-based file routing.
 * Groups: (auth) — phone/verify flow; (app) — the authenticated tab shell.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
