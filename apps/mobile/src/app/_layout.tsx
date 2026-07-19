import '../global.css';

import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Root layout — wraps the app tree in GestureHandlerRootView and
 * SafeAreaProvider, loads the Playfair Display heading fonts behind the
 * splash screen, and themes the status bar to the OS color scheme.
 * Groups: (auth) — phone/verify flow; (app) — tab-based home/profile.
 */
void SplashScreen.preventAutoHideAsync();

const rootStyle = { flex: 1 } as const;

export default function RootLayout() {
  const { isDark } = useThemeColors();
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Keep the splash visible until heading fonts resolve (or fail — then
  // render anyway with the system font rather than blocking the app).
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={rootStyle}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
