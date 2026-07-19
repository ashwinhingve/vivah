import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { withAlpha } from '@/theme/tokens';
import { useSession } from '@/hooks/useSession';
import { canUseBiometric, isBiometricEnabled, shouldPromptBiometric } from '@/lib/biometric';

/**
 * Authenticated tab shell — four tabs:
 * Matches · Chat · Profile · More.
 *
 * Each tab is an expo-router GROUP, not a single screen, so a track owns a whole
 * stack (list → detail → sub-detail) without touching this file. That is the
 * point: this layout is Phase-0 shared property and no Phase-1 track edits it.
 *
 * Teal (active) / muted (inactive) icons + labels on a themed surface.
 *
 * Biometric gate:
 * Fires when the user has a valid session AND has opted into biometric AND
 * the device has hardware + enrolled biometrics. Re-arms on returning from
 * background (AppState).
 *
 * The gate does NOT interpose on the initial phone→OTP flow — that would be
 * a login regression. It only gates re-entry over an already-stored session.
 */
export default function AppLayout() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const { data: session } = useSession();
  const appStateRef = useRef(AppState.currentState);
  const biometricShownRef = useRef(false);

  // Re-arm biometric check on foreground (return from background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [session]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    const currentAppState = appStateRef.current;
    appStateRef.current = nextAppState;

    // Arm biometric gate when returning from background
    if (
      currentAppState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // Gather inputs for the pure decision function
      const hasSession = !!session?.user;
      const optedIn = await isBiometricEnabled();
      const hardwareCheckResult = await canUseBiometric();
      const hardwareAvailable = hardwareCheckResult.canUse;
      const alreadyUnlocked = biometricShownRef.current;

      // Call the pure decision function
      const shouldPrompt = shouldPromptBiometric({
        hasSession,
        optedIn,
        hardwareAvailable,
        alreadyUnlockedThisSession: alreadyUnlocked,
      });

      if (shouldPrompt) {
        biometricShownRef.current = true;
        router.push('/(app)/biometric-unlock');
      } else {
        // Reset flag if conditions aren't met
        biometricShownRef.current = false;
      }
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: withAlpha(colors.gold, '33'),
          borderTopWidth: 1,
          // 44px minimum touch target (design system), plus room for the label.
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="(matches)"
        options={{
          title: 'Matches',
          tabBarLabel: 'Matches',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(chat)"
        options={{
          title: 'Chat',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(vendors)"
        options={{
          title: 'Vendors',
          tabBarLabel: 'Vendors',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* Reachable by navigation, but not its own tab. */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="biometric-unlock" options={{ href: null }} />
    </Tabs>
  );
}
