import { Tabs } from 'expo-router';

/**
 * App group layout — Phase-1.
 * A Tabs navigator for the authenticated user: home (Teammate B) and profile (Teammate A).
 * Tab bar uses teal (active) / muted (inactive) colors with surface background.
 */
export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0E7C7B', // teal
        tabBarInactiveTintColor: '#6B6B76', // muted
        tabBarStyle: {
          backgroundColor: '#FFFFFF', // surface
          borderTopColor: '#C5A47E33', // gold with transparency
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          // Icon omitted — using text label only
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          // Icon omitted — using text label only
        }}
      />
    </Tabs>
  );
}
