import { Tabs } from 'expo-router';
import { tokens } from '../../theme/tokens';

/**
 * Authenticated tab shell — four tabs, matching the Sprint I scope:
 * Matches (Track B) · Chat (Track C) · Profile (Track A) · More (Track A).
 *
 * Each tab is an expo-router GROUP, not a single screen, so a track owns a whole
 * stack (list → detail → sub-detail) without touching this file. That is the
 * point: this layout is Phase-0 shared property and no Phase-1 track edits it.
 */
export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.teal,
        tabBarInactiveTintColor: tokens.muted,
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopColor: `${tokens.gold}33`,
          borderTopWidth: 1,
          // 44px minimum touch target (design system), plus room for the label.
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="(matches)" options={{ title: 'Matches', tabBarLabel: 'Matches' }} />
      <Tabs.Screen name="(chat)" options={{ title: 'Chat', tabBarLabel: 'Chat' }} />
      <Tabs.Screen name="(profile)" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarLabel: 'More' }} />

      {/* Reachable by navigation, but not its own tab. */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
