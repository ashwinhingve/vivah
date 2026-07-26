import '../global.css';

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { useThemeColors } from '@/hooks/useThemeColors';

import { queryClient } from '../lib/queryClient';
import { bootDiagnostics } from '../lib/bootDiagnostics';

/**
 * Root layout — wraps the app tree in GestureHandlerRootView, SafeAreaProvider
 * and the React Query provider, loads the Playfair Display heading fonts behind
 * the splash screen, and themes the status bar to the OS color scheme.
 * Groups: (auth) — phone/verify flow; (app) — the authenticated tab shell.
 */
void SplashScreen.preventAutoHideAsync();

const rootStyle = { flex: 1 } as const;

// If the heading fonts haven't resolved within this window, stop waiting behind
// the splash and render with the system font — a font CDN stall must never hold
// the app on a frozen splash screen.
const FONT_TIMEOUT_MS = 3000;

export default function RootLayout() {
  const { isDark } = useThemeColors();
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      bootDiagnostics.log('fonts.ready', { loaded: fontsLoaded, error: !!fontError });
      void SplashScreen.hideAsync();
      return;
    }
    const timer = setTimeout(() => {
      bootDiagnostics.log('fonts.timeout');
      setFontTimedOut(true);
      void SplashScreen.hideAsync();
    }, FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  // Keep the splash visible until heading fonts resolve, fail, or time out —
  // then render regardless (system font as the fallback) rather than blocking.
  if (!fontsLoaded && !fontError && !fontTimedOut) {
    return null;
  }

  return (
    <GestureHandlerRootView style={rootStyle}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Expo Router renders this in place of the route tree on any uncaught render
 * error, guaranteeing a frozen splash can never be the end state. Styled with
 * inline literals rather than NativeWind classes ON PURPOSE: this must survive
 * even if the styling pipeline itself is what threw. (This is the one screen
 * where raw hex is correct — do not "fix" it to tokens.) `retry` re-mounts the
 * route tree from scratch.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void SplashScreen.hideAsync();
    bootDiagnostics.log('errorBoundary', { message: error.message });
  }, [error]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FEFAF6',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '600',
          color: '#7B2D42',
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: '#6B6B76',
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        The app hit an unexpected error while starting up. Please try again.
      </Text>
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        style={{
          minHeight: 44,
          paddingHorizontal: 24,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#0E7C7B',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#0E7C7B', fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}
