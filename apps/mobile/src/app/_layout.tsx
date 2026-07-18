import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Root layout — Phase-0 frozen shell. Teammate A replaces this with the real
 * navigation tree ((auth) group + (app) tab group + the auth gate). Keep the
 * `../global.css` import first so NativeWind styles load app-wide.
 */
export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </>
  );
}
