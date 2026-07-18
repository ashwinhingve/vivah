import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../hooks/useSession';

/**
 * Root auth gate — Phase-1.
 *
 * Checks the Better Auth session and redirects:
 * - Loading → centered spinner
 * - Session exists → the Matches tab (the app's landing surface)
 * - No session → /(auth)/phone
 */
export default function RootGate() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    const data = session.data;

    // Session is still loading
    if (session.isPending) {
      return;
    }

    // Session exists — land on the Matches tab
    if (data?.user) {
      router.replace('/(app)/(matches)');
    } else {
      // No session — redirect to phone login
      router.replace('/(auth)/phone');
    }
  }, [session.data, session.isPending, router]);

  // Show loading state while checking session
  if (session.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#7B2D42" />
      </View>
    );
  }

  // Render nothing while redirect happens
  return null;
}
