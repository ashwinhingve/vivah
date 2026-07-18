import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../hooks/useSession';
import { authClient } from '../../lib/auth-client';

/**
 * Authenticated home screen — Phase-1.
 *
 * Displays the signed-in user's details (phone, name) from the Better Auth session.
 * Includes a sign-out button that clears the session and redirects to phone login.
 *
 * This proves the cookie round-tripped from /api/auth/get-session to the mobile app.
 */
export default function HomeScreen() {
  const router = useRouter();
  const session = useSession();

  // If session cleared (signed out), redirect to login
  useEffect(() => {
    if (!session.data?.user && !session.isPending) {
      router.replace('/(auth)/phone');
    }
  }, [session.data?.user, session.isPending, router]);

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.replace('/(auth)/phone');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Show loading while fetching session
  if (session.isPending) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#7B2D42" />
      </View>
    );
  }

  const user = session.data?.user;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-8">
      {/* Header */}
      <View className="mb-8">
        {/* TODO: Playfair Display heading via expo-font (Phase 7) */}
        <Text className="text-primary text-3xl font-bold mb-2">Welcome to Smart Shaadi</Text>
        <Text className="text-gold-muted text-base">Mobile app scaffold — Phase 7.1</Text>
      </View>

      {/* User Info Card */}
      <View className="bg-surface rounded-2xl p-6 mb-8 border border-gold/40">
        <Text className="text-primary font-semibold text-sm mb-4">Your Account</Text>

        {/* Phone */}
        <View className="mb-4">
          <Text className="text-gold-muted text-xs mb-1">Phone</Text>
          <Text className="text-primary text-base font-mono">
            {user?.phoneNumber || user?.email || 'Not set'}
          </Text>
        </View>

        {/* Name */}
        <View className="mb-4">
          <Text className="text-gold-muted text-xs mb-1">Name</Text>
          <Text className="text-primary text-base">{user?.name || 'Not set'}</Text>
        </View>

        {/* User ID */}
        <View>
          <Text className="text-gold-muted text-xs mb-1">User ID</Text>
          <Text className="text-primary text-xs font-mono">{user?.id || 'N/A'}</Text>
        </View>
      </View>

      {/* Session Status */}
      <View className="bg-surface border border-success/40 rounded-lg p-4 mb-8">
        <Text className="text-success font-semibold text-sm">Session Active</Text>
        <Text className="text-gold-muted text-xs mt-1">
          Your session cookie is persisted via expo-secure-store and re-injected with every request.
        </Text>
      </View>

      {/* Sign Out Button */}
      <Pressable
        onPress={handleSignOut}
        className="bg-destructive py-3 px-6 rounded-lg items-center justify-center mb-6 min-h-11"
      >
        <Text className="text-white font-semibold">Sign Out</Text>
      </Pressable>

      {/* Info Footer */}
      <View className="bg-surface border border-gold/40 rounded-lg p-4">
        <Text className="text-gold-muted text-xs leading-5">
          <Text className="font-semibold">Next steps:</Text> This is the scaffold home screen. In Phase 7.2+, add profile editing, match discovery, and messaging here.
        </Text>
      </View>
    </ScrollView>
  );
}
