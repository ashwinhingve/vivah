import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { fetchSessionDirect } from '../lib/auth-client';
import { bootDiagnostics } from '../lib/bootDiagnostics';
import { LoadingView } from '@/components/LoadingView';
import { BootErrorScreen } from '@/components/BootErrorScreen';

/**
 * Root auth gate — decides the first screen and, crucially, can never hang.
 *
 * Fast path: the moment the Better Auth `useSession` hook settles, redirect to
 * the Matches tab (has session) or phone login (no session).
 *
 * Safety net: that hook's store can wedge in a release build — its initial
 * fetch never flips `isPending`, which is what stranded earlier APKs on an
 * endless spinner. So if the hook hasn't settled within a grace window (or
 * reports an error), we stop trusting it and fetch the session directly with a
 * hard timeout. A reachable server then still resolves the boot; an unreachable
 * one surfaces an actionable retry screen instead of a frozen animation.
 */

// Give the session hook this long to settle on its own before falling back.
// Healthy boots resolve in well under a second; this budget only bites on slow
// networks or a wedged hook.
const HOOK_GRACE_MS = 6000;
// Hard cap on the direct fallback fetch so an unreachable server errors out
// rather than spinning forever.
const DIRECT_TIMEOUT_MS = 8000;

export default function RootGate() {
  const router = useRouter();
  const session = useSession();
  const [showError, setShowError] = useState(false);

  // Guards against double navigation / racing the hook and the fallback: once
  // one of them wins, the other is a no-op. Reset only by an explicit retry.
  const settledRef = useRef(false);
  const fallbackStartedRef = useRef(false);

  const goToApp = useCallback(
    (hasUser: boolean) => {
      if (settledRef.current) return;
      settledRef.current = true;
      const target = hasUser ? '/(app)/(matches)' : '/(auth)/phone';
      bootDiagnostics.log('navigate', { target });
      router.replace(target);
    },
    [router],
  );

  const runFallback = useCallback(async () => {
    if (settledRef.current || fallbackStartedRef.current) return;
    fallbackStartedRef.current = true;
    bootDiagnostics.log('fallback.start');
    try {
      const result = await fetchSessionDirect(DIRECT_TIMEOUT_MS);
      bootDiagnostics.log('fallback.resolved', { hasUser: !!result?.user });
      goToApp(!!result?.user);
    } catch (err) {
      bootDiagnostics.log('fallback.failed', { message: String(err) });
      if (settledRef.current) return;
      settledRef.current = true; // block a late hook resolve from navigating over the error
      setShowError(true);
    }
  }, [goToApp]);

  // Fast path — honor the hook as soon as it settles.
  useEffect(() => {
    if (settledRef.current) return;
    if (session.isPending) return;
    if (session.error) {
      // The hook errored — don't give up yet; a clean direct fetch may still
      // succeed (the hook's store failing does not mean the network is down).
      bootDiagnostics.log('hook.error', { message: String(session.error) });
      void runFallback();
      return;
    }
    bootDiagnostics.log('hook.resolved', { hasUser: !!session.data?.user });
    goToApp(!!session.data?.user);
  }, [session.isPending, session.data?.user, session.error, goToApp, runFallback]);

  // Safety net — if the hook hasn't settled within the grace window, fetch the
  // session ourselves.
  useEffect(() => {
    bootDiagnostics.log('mounted');
    const timer = setTimeout(() => {
      if (settledRef.current) return;
      bootDiagnostics.log('hook.timeout');
      void runFallback();
    }, HOOK_GRACE_MS);
    return () => clearTimeout(timer);
  }, [runFallback]);

  const handleRetry = useCallback(() => {
    bootDiagnostics.log('retry');
    settledRef.current = false;
    fallbackStartedRef.current = false;
    setShowError(false);
    void runFallback();
  }, [runFallback]);

  if (showError) {
    return <BootErrorScreen onRetry={handleRetry} />;
  }

  return <LoadingView label="Getting things ready" />;
}
