import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  canUseBiometric,
  isBiometricEnabled,
  shouldPromptBiometric,
  getLastUnlockAt,
} from '@/lib/biometric';

/**
 * Biometric re-entry gate wiring.
 *
 * Extracted from `(app)/_layout.tsx` so it is testable at all: AppLayout renders
 * `<Tabs>`, which trips a displayName error in react-native-css-interop under
 * RNTL, so anything left inside that component is untestable by construction.
 * The pure decision lives in `shouldPromptBiometric`; this hook owns the part
 * that decides *when* to ask — which is where the cold-start bug actually was.
 *
 * Fires on mount (cold start) AND on background→foreground. Cold start is the
 * case users mean by "biometric lock": app force-quit, reopened while the session
 * cookie is still in expo-secure-store. Before this ran on mount, that path
 * reached the app with no prompt at all.
 */
export function useBiometricGate(params: {
  hasSession: boolean;
  sessionLoading: boolean;
  onPrompt: () => void;
}) {
  const { hasSession, sessionLoading, onPrompt } = params;
  const appStateRef = useRef(AppState.currentState);
  const shownRef = useRef(false);

  // Keep the latest onPrompt without making it an effect dependency — a caller
  // passing an inline arrow would otherwise re-subscribe on every render.
  const onPromptRef = useRef(onPrompt);
  onPromptRef.current = onPrompt;

  async function evaluateGate(sessionPresent: boolean) {
    const optedIn = await isBiometricEnabled();
    const { canUse } = await canUseBiometric();
    const lastUnlockAt = await getLastUnlockAt();

    const shouldPrompt = shouldPromptBiometric({
      hasSession: sessionPresent,
      optedIn,
      hardwareAvailable: canUse,
      alreadyUnlockedThisSession: shownRef.current,
      lastUnlockAt,
      now: Date.now(),
    });

    if (shouldPrompt) {
      shownRef.current = true;
      onPromptRef.current();
    } else {
      shownRef.current = false;
    }
  }

  // Cold start. Keyed on hasSession (a boolean) rather than the session object:
  // if `data` lands a render after `isPending` clears, an effect keyed only on
  // sessionLoading would evaluate with a stale hasSession=false and the gate
  // would silently never fire — the very hole this exists to close.
  useEffect(() => {
    if (!sessionLoading) void evaluateGate(hasSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, hasSession]);

  // Return from background.
  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      // AppState.currentState can be undefined before the first transition (and
      // is undefined under jest-expo). Coerce rather than calling .match on it —
      // a throw here would take the listener down and silently disable the gate.
      const prev = String(appStateRef.current ?? '');
      appStateRef.current = next;
      if (/inactive|background/.test(prev) && next === 'active') {
        void evaluateGate(hasSession);
      }
    };

    const sub = AppState.addEventListener('change', handleChange);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);
}
