import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Biometric authentication wrapper.
 *
 * Gate re-entry over an already-persisted session (OTP is identity factor).
 * Biometric CANNOT replace phone-OTP login.
 */

const BIOMETRIC_ENABLED_KEY = 'smartshaadi_biometric_enabled';

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
 * Pure decision function: should the app prompt for biometric unlock?
 *
 * This is extracted from _layout.tsx so it can be unit tested independently.
 * The gate logic is:
 *   IF user has a session (already logged in)
 *   AND user has opted into biometric
 *   AND device has hardware + enrolled biometrics
 *   AND hasn't already unlocked this session
 *   THEN prompt for biometric
 *
 * The `hasSession` check is CRITICAL: it's the login regression guard.
 * If this inverts, the gate fires during phone→OTP, locking everyone out.
 *
 * @param input The four inputs to the decision:
 *   - hasSession: User has a valid auth session (already logged in via OTP)
 *   - optedIn: User enabled biometric in settings
 *   - hardwareAvailable: Device has sensor + enrolled biometrics
 *   - alreadyUnlockedThisSession: Gate already fired in this session
 * @returns true if should prompt, false otherwise
 */
export function shouldPromptBiometric(input: {
  hasSession: boolean;
  optedIn: boolean;
  hardwareAvailable: boolean;
  alreadyUnlockedThisSession: boolean;
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

  // All conditions met: prompt for biometric
  return true;
}
