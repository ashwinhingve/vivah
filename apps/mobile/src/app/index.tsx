import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { LoadingView } from '@/components/LoadingView';

/**
 * Root auth gate.
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
    return <LoadingView />;
  }

  // Render nothing while redirect happens
  return null;
}
