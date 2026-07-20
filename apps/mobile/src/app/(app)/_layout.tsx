import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { withAlpha } from '@/theme/tokens';
import { useSession } from '@/hooks/useSession';
import { useBiometricGate } from '@/hooks/useBiometricGate';

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
 * Cold-start gap fix: gate is evaluated on mount (when session loading settles)
 * AND on AppState foreground transitions. Grace window prevents re-prompting
 * within 60 seconds of unlock.
 *
 * The gate does NOT interpose on the initial phone→OTP flow — that would be
 * a login regression. It only gates re-entry over an already-stored session.
 */
export default function AppLayout() {
  const { colors } = useThemeColors();
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
