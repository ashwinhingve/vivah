import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { withAlpha } from '@/theme/tokens';

/**
 * Authenticated tab shell — four tabs:
 * Matches · Chat · Profile · More.
 *
 * Each tab is an expo-router GROUP, not a single screen, so a track owns a whole
 * stack (list → detail → sub-detail) without touching this file. That is the
 * point: this layout is Phase-0 shared property and no Phase-1 track edits it.
 *
 * Teal (active) / muted (inactive) icons + labels on a themed surface.
 */
export default function AppLayout() {
  const { colors } = useThemeColors();

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
    </Tabs>
  );
}
