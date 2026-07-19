import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../hooks/useSession';
import { authClient } from '../../lib/auth-client';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/LoadingView';
import { InfoNote } from '@/components/InfoNote';

/**
 * Authenticated home screen.
 *
 * Displays the signed-in user's details (phone, name) from the Better Auth
 * session, with pull-to-refresh. Sign-out is confirmed before clearing the
 * session and redirecting to phone login.
 */
export default function HomeScreen() {
  const router = useRouter();
  const session = useSession();
  const { colors } = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);

  // If session cleared (signed out), redirect to login
  useEffect(() => {
    if (!session.data?.user && !session.isPending) {
      router.replace('/(auth)/phone');
    }
  }, [session.data?.user, session.isPending, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await session.refetch();
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.refetch]);

  const handleSignOut = useCallback(async () => {
    try {
      await authClient.signOut();
      router.replace('/(auth)/phone');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, [router]);

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need to verify your phone number to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void handleSignOut() },
    ]);
  }, [handleSignOut]);

  // Show loading while fetching session
  if (session.isPending) {
    return <LoadingView />;
  }

  const user = session.data?.user;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header */}
      <View className="mb-8">
        <Text className="text-primary font-heading-bold text-3xl mb-2">
          Welcome to Smart Shaadi
        </Text>
        <Text className="text-gold-muted text-base">Mobile app scaffold — Phase 7.1</Text>
      </View>

      {/* User Info Card */}
      <Card className="mb-8">
        <Text className="text-primary font-semibold text-sm mb-4">Your Account</Text>

        {/* Phone */}
        <View className="mb-4">
          <Text className="text-gold-muted text-xs mb-1">Phone</Text>
          <Text className="text-ink text-base font-mono">
            {user?.phoneNumber || user?.email || 'Not set'}
          </Text>
        </View>

        {/* Name */}
        <View className="mb-4">
          <Text className="text-gold-muted text-xs mb-1">Name</Text>
          <Text className="text-ink text-base">{user?.name || 'Not set'}</Text>
        </View>

        {/* User ID */}
        <View>
          <Text className="text-gold-muted text-xs mb-1">User ID</Text>
          <Text className="text-ink text-xs font-mono">{user?.id || 'N/A'}</Text>
        </View>
      </Card>

      {/* Session Status */}
      <InfoNote variant="success" title="Session Active" className="mb-8">
        Your session cookie is persisted via expo-secure-store and re-injected with every request.
      </InfoNote>

      {/* Sign Out Button */}
      <View className="mb-6">
        <Button
          title="Sign Out"
          variant="destructive"
          onPress={confirmSignOut}
          accessibilityHint="Asks for confirmation before signing you out"
        />
      </View>

      {/* Info Footer */}
      <InfoNote variant="info" title="Next steps">
        This is the scaffold home screen. In Phase 7.2+, add profile editing, match discovery,
        and messaging here.
      </InfoNote>
    </Screen>
  );
}
