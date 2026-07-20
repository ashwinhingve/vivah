import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Biometric authentication wrapper.
 *
 * Gate re-entry over an already-persisted session (OTP is identity factor).
 * Biometric CANNOT replace phone-OTP login.
 */

const BIOMETRIC_ENABLED_KEY = 'smartshaadi_biometric_enabled';
const LAST_UNLOCK_KEY = 'smartshaadi_biometric_last_unlock';

/**
 * Grace window after successful unlock: 60 seconds.
 * If the user was unlocked less than this many milliseconds ago,
 * don't re-prompt on foreground.
 */
export const GRACE_MS = 60_000;

/**
 * Check if the device has biometric hardware available AND
 * has biometrics enrolled (face/fingerprint).
 *
 * Two separate checks:
 * - hasHardwareAsync: device has a sensor (Face ID, Touch ID, fingerprint)
 * - isEnrolledAsync: user has enrolled at least one biometric
 *
 * Both must be true for biometric to work. If either is false,
 * the settings toggle must be disabled with an explanatory message.
 */
export async function canUseBiometric(): Promise<{
  canUse: boolean;
  reason?: 'no_hardware' | 'not_enrolled';
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { canUse: false, reason: 'no_hardware' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { canUse: false, reason: 'not_enrolled' };
    }

    return { canUse: true };
  } catch (error) {
    console.error('[biometric] canUseBiometric error:', error);
    return { canUse: false, reason: 'not_enrolled' };
  }
}

/**
 * Prompt the user for biometric authentication (face/fingerprint).
 *
 * Returns true if authentication succeeded, false otherwise.
 * Handles user cancellation gracefully.
 */
export async function authenticate(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: false,
      fallbackLabel: 'Use phone OTP instead',
    });

    return result.success;
  } catch (error) {
    console.error('[biometric] authenticate error:', error);
    return false;
  }
}

/**
 * Enable biometric (persist opt-in flag to secure storage).
 */
export async function enableBiometric(): Promise<void> {
  try {
    SecureStore.setItem(BIOMETRIC_ENABLED_KEY, 'true');
  } catch (error) {
    console.error('[biometric] enableBiometric error:', error);
  }
}

/**
 * Disable biometric (clear opt-in flag).
 */
export async function disableBiometric(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  } catch (error) {
    console.error('[biometric] disableBiometric error:', error);
  }
}

/**
 * Check if biometric is enabled (user has opted in).
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const stored = SecureStore.getItem(BIOMETRIC_ENABLED_KEY);
    return stored === 'true';
  } catch (error) {
    console.error('[biometric] isBiometricEnabled error:', error);
    return false;
  }
}

/**
 * Record the timestamp of a successful biometric unlock.
 * Stored as an epoch-ms string in SecureStore.
 */
export async function recordUnlock(): Promise<void> {
  try {
    const now = Date.now().toString();
    SecureStore.setItem(LAST_UNLOCK_KEY, now);
  } catch (error) {
    console.error('[biometric] recordUnlock error:', error);
  }
}

/**
 * Retrieve the timestamp of the last successful unlock.
 * Returns null if never unlocked or if the stored value is invalid.
 * A non-numeric or unparseable value returns null (fail closed → prompt).
 */
export async function getLastUnlockAt(): Promise<number | null> {
  try {
    const stored = SecureStore.getItem(LAST_UNLOCK_KEY);
    if (stored === null) {
      return null;
    }

    const ms = parseInt(stored, 10);
    // Fail closed: if parse fails or result is NaN, return null (re-prompt)
    if (isNaN(ms)) {
      return null;
    }

    return ms;
  } catch (error) {
    console.error('[biometric] getLastUnlockAt error:', error);
    return null;
  }
}

/**
 * Pure decision function: should the app prompt for biometric unlock?
 *
 * This is extracted from _layout.tsx so it can be unit tested independently.
 * The gate logic is:
 *   IF user has a session (already logged in)
 *   AND user has opted into biometric
 *   AND device has hardware + enrolled biometrics
 *   AND hasn't already unlocked this session
 *   AND is NOT within the grace window after the last unlock
 *   THEN prompt for biometric
 *
 * The `hasSession` check is CRITICAL: it's the login regression guard.
 * If this inverts, the gate fires during phone→OTP, locking everyone out.
 *
 * The grace window (60 seconds) prevents re-prompting immediately after
 * returning from background — the user just unlocked.
 *
 * @param input The inputs to the decision:
 *   - hasSession: User has a valid auth session (already logged in via OTP)
 *   - optedIn: User enabled biometric in settings
 *   - hardwareAvailable: Device has sensor + enrolled biometrics
 *   - alreadyUnlockedThisSession: Gate already fired in this session
 *   - lastUnlockAt: Epoch-ms timestamp of last successful unlock (or null if never)
 *   - now: Current time in epoch-ms (for testing; defaults to Date.now())
 * @returns true if should prompt, false otherwise
 */
export function shouldPromptBiometric(input: {
  hasSession: boolean;
  optedIn: boolean;
  hardwareAvailable: boolean;
  alreadyUnlockedThisSession: boolean;
  lastUnlockAt?: number | null;
  now?: number;
}): boolean {
  // Login regression guard: if no session, NEVER fire the gate
  // User must log in via OTP first before biometric can unlock
  if (!input.hasSession) {
    return false;
  }

  // If user hasn't opted in, don't fire
  if (!input.optedIn) {
    return false;
  }

  // If hardware isn't available, don't strand user at a prompt
  if (!input.hardwareAvailable) {
    return false;
  }

  // Don't re-prompt if already unlocked this session
  if (input.alreadyUnlockedThisSession) {
    return false;
  }

  // Grace window: if unlocked recently (within 60s), don't re-prompt
  const now = input.now ?? Date.now();
  const lastUnlockAt = input.lastUnlockAt;

  if (lastUnlockAt !== null && lastUnlockAt !== undefined) {
    const timeSinceUnlock = now - lastUnlockAt;
    // If unlocked less than GRACE_MS ago AND clock is reasonable (time >= 0)
    // then don't prompt. Fail closed: if clock skew (future lastUnlockAt),
    // DO prompt.
    if (timeSinceUnlock >= 0 && timeSinceUnlock < GRACE_MS) {
      return false;
    }
  }

  // All conditions met: prompt for biometric
  return true;
}
