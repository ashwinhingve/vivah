import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useSession } from '@/hooks/useSession';
import { useBiometricGate } from '@/hooks/useBiometricGate';

/**
 * Authenticated tab shell — five tabs:
 * Matches · Chat · Vendors · Profile · More.
 *
 * Each tab is an expo-router GROUP, not a single screen, so a track owns a whole
 * stack (list → detail → sub-detail) without touching this file. That is the
 * point: this layout is Phase-0 shared property and no Phase-1 track edits it.
 *
 * Navigation chrome is the custom FloatingTabBar (floating burgundy-pill bar).
 * Every non-tab file in this directory MUST be declared below with
 * `href: null` — expo-router otherwise surfaces it as an extra tab. The
 * FloatingTabBar also whitelists the five tab routes as a second guard.
 *
 * Biometric gate:
 * Fires when the user has a valid session AND has opted into biometric AND
 * the device has hardware + enrolled biometrics. Re-arms on returning from
 * background (AppState).
 *
 * Cold-start gap fix: gate is evaluated on mount (when session loading settles)
 * AND on AppState foreground transitions. Grace window prevents re-prompting
 * within 60 seconds of unlock.
 *
 * The gate does NOT interpose on the initial phone→OTP flow — that would be
 * a login regression. It only gates re-entry over an already-stored session.
 */
export default function AppLayout() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  // Biometric re-entry gate. Lives in a hook rather than inline effects because
  // this component cannot be rendered under RNTL (Tabs trips a displayName error
  // in react-native-css-interop), so anything left here is untestable — which is
  // exactly how the cold-start hole survived unnoticed.
  useBiometricGate({
    hasSession: !!session?.user,
    sessionLoading,
    onPrompt: () => router.push('/(app)/biometric-unlock'),
  });

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="(matches)" options={{ title: 'Matches' }} />
      <Tabs.Screen name="(chat)" options={{ title: 'Chat' }} />
      <Tabs.Screen name="(vendors)" options={{ title: 'Vendors' }} />
      <Tabs.Screen name="(profile)" options={{ title: 'Profile' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />

      {/* Reachable by navigation, but not tabs. Every non-tab route in this
          directory must be listed here or expo-router adds it to the bar. */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="biometric-unlock" options={{ href: null }} />
      <Tabs.Screen name="billing" options={{ href: null }} />
      <Tabs.Screen name="blocked-users" options={{ href: null }} />
      <Tabs.Screen name="bookings" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="notification-preferences" options={{ href: null }} />
      <Tabs.Screen name="booking/[vendorId]" options={{ href: null }} />
    </Tabs>
  );
}
