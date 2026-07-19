import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { LoadingView } from '@/components/LoadingView';

/**
 * Root auth gate.
 *
 * Checks the Better Auth session and redirects:
 * - Loading → centered spinner
 * - Session exists → /(app)/home
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

    // Session exists — redirect to authenticated home
    if (data?.user) {
      router.replace('/(app)/home');
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
