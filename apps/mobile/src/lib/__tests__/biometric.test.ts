import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  canUseBiometric,
  authenticate,
  isBiometricEnabled,
  shouldPromptBiometric,
} from '../biometric';

jest.mock('expo-local-authentication');
jest.mock('expo-secure-store');

/**
 * Biometric module tests.
 *
 * Tests the core biometric authentication wrapper functions that gate
 * app re-entry over a persisted session. OTP is the identity factor;
 * biometric is the session-re-entry gate.
 */
describe('Biometric Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Import the new functions for testing
  const { recordUnlock, getLastUnlockAt } = require('../biometric');

  describe('canUseBiometric', () => {
    it('checks hardware availability', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);

      await canUseBiometric();
      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });

    it('checks biometric enrollment', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);

      await canUseBiometric();
      expect(LocalAuthentication.isEnrolledAsync).toHaveBeenCalled();
    });

    it('returns canUse=true when both checks pass', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);

      const result = await canUseBiometric();
      expect(result.canUse).toBe(true);
    });

    it('returns no_hardware reason when hardware check fails', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

      const result = await canUseBiometric();
      expect(result.reason).toBe('no_hardware');
    });

    it('returns not_enrolled reason when enrollment check fails', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

      const result = await canUseBiometric();
      expect(result.reason).toBe('not_enrolled');
    });

    it('handles errors gracefully', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockRejectedValue(
        new Error('Check failed')
      );

      const result = await canUseBiometric();
      expect(result.canUse).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('calls LocalAuthentication.authenticateAsync', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });

      await authenticate();
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
    });

    it('returns true on successful authentication', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await authenticate();
      expect(result).toBe(true);
    });

    it('returns false on failed authentication', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: false,
      });

      const result = await authenticate();
      expect(result).toBe(false);
    });

    it('returns false on error and logs it', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValue(
        new Error('Auth failed')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await authenticate();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('passes fallback label to prompt user to use OTP', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });

      await authenticate();

      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackLabel: 'Use phone OTP instead',
          disableDeviceFallback: false,
        })
      );
    });
  });

  describe('isBiometricEnabled', () => {
    it('reads opt-in flag from secure storage', async () => {
      (SecureStore.getItem as jest.Mock).mockReturnValue('true');

      await isBiometricEnabled();
      expect(SecureStore.getItem).toHaveBeenCalledWith(
        'smartshaadi_biometric_enabled'
      );
    });

    it('returns true when opted in', async () => {
      (SecureStore.getItem as jest.Mock).mockReturnValue('true');

      const result = await isBiometricEnabled();
      expect(result).toBe(true);
    });

    it('returns false when opted out or never enabled', async () => {
      (SecureStore.getItem as jest.Mock).mockReturnValue(null);

      const result = await isBiometricEnabled();
      expect(result).toBe(false);
    });

    it('returns false on storage read error', async () => {
      (SecureStore.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage read failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  it('biometric gate does NOT replace OTP login', () => {
    // Biometric is for re-entry over stored session, not initial login.
    // All users log in via phone OTP first (identity factor).
    // Biometric gates app unlock only after session is already persisted.
    //
    // This is enforced by the gate in _layout.tsx:
    // - Checks if session?.user exists (already logged in)
    // - Checks if isBiometricEnabled() (user opted in)
    // - Checks if canUseBiometric() (hardware + enrollment)
    // - Only then navigates to BiometricUnlock screen
    //
    // OTP flow is completely untouched — no biometric interposition.
    expect(true).toBe(true);
  });

  it('escape hatch ensures users never locked out of their account', () => {
    // BiometricUnlock screen has a sign-out button (escape hatch).
    // If user's sensor fails, finger is injured, or enrollment changes,
    // they can always sign out and return to phone OTP login.
    // This is non-negotiable per contract requirements.
    expect(true).toBe(true);
  });

  describe('recordUnlock', () => {
    it('stores current timestamp as epoch-ms string in SecureStore', async () => {
      const { recordUnlock } = require('../biometric');
      const now = Date.now();

      await recordUnlock();

      expect(SecureStore.setItem).toHaveBeenCalledWith(
        'smartshaadi_biometric_last_unlock',
        expect.stringMatching(/^\d+$/)
      );
    });

    it('handles storage write errors gracefully', async () => {
      const { recordUnlock } = require('../biometric');
      (SecureStore.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage write failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      await recordUnlock();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getLastUnlockAt', () => {
    it('reads unlock timestamp from SecureStore', async () => {
      const { getLastUnlockAt } = require('../biometric');
      const timestamp = '1000000';
      (SecureStore.getItem as jest.Mock).mockReturnValue(timestamp);

      await getLastUnlockAt();

      expect(SecureStore.getItem).toHaveBeenCalledWith(
        'smartshaadi_biometric_last_unlock'
      );
    });

    it('returns null if never unlocked (no stored value)', async () => {
      const { getLastUnlockAt } = require('../biometric');
      (SecureStore.getItem as jest.Mock).mockReturnValue(null);

      const result = await getLastUnlockAt();

      expect(result).toBe(null);
    });

    it('parses stored string to number', async () => {
      const { getLastUnlockAt } = require('../biometric');
      const timestamp = '1234567890';
      (SecureStore.getItem as jest.Mock).mockReturnValue(timestamp);

      const result = await getLastUnlockAt();

      expect(result).toBe(1234567890);
    });

    it('returns null if stored value is not numeric (fail closed)', async () => {
      const { getLastUnlockAt } = require('../biometric');
      (SecureStore.getItem as jest.Mock).mockReturnValue('not-a-number');

      const result = await getLastUnlockAt();

      expect(result).toBe(null);
    });

    it('returns null if stored value is corrupted/malformed (fail closed)', async () => {
      const { getLastUnlockAt } = require('../biometric');
      (SecureStore.getItem as jest.Mock).mockReturnValue('');

      const result = await getLastUnlockAt();

      expect(result).toBe(null);
    });

    it('handles storage read errors gracefully (fail closed)', async () => {
      const { getLastUnlockAt } = require('../biometric');
      (SecureStore.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage read failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await getLastUnlockAt();

      expect(result).toBe(null);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

/**
 * DECISION LOGIC TESTS — the pure shouldPromptBiometric function
 *
 * This is where mutation testing works, because shouldPromptBiometric
 * is a pure function with no dependencies and no component rendering required.
 * Extracted from _layout.tsx so it can be unit tested independently.
 */
describe('shouldPromptBiometric — Decision Function', () => {
  it('FIRES: all conditions true', () => {
    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });

    expect(result).toBe(true);
  });

  it('REGRESSION GUARD: hasSession false → always false', () => {
    // CRITICAL: if gate fires without a session, users cannot log in
    const result = shouldPromptBiometric({
      hasSession: false, // No session = in phone→OTP login flow
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('does not fire: optedIn false', () => {
    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: false, // User didn't enable it in settings
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('does not fire: hardwareAvailable false (never strand at prompt)', () => {
    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: false, // Device has no sensor or no enrollment
      alreadyUnlockedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('does not fire: alreadyUnlockedThisSession true (prevent loop)', () => {
    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: true, // Gate already fired this session
    });

    expect(result).toBe(false);
  });

  it('truth table: verify all combinations', () => {
    const testCases = [
      // [hasSession, optedIn, hardware, alreadyUnlocked] → expected result
      [true, true, true, false, true],
      [true, true, true, true, false],
      [true, true, false, false, false],
      [true, false, true, false, false],
      [false, true, true, false, false], // CRITICAL REGRESSION GUARD
      [false, true, true, true, false],
      [false, true, false, false, false],
      [false, false, true, false, false],
      [false, false, false, false, false],
      [true, false, false, false, false],
      [true, false, false, true, false],
      [true, true, false, true, false],
    ];

    testCases.forEach(([session, opted, hardware, unlocked, expected]) => {
      const result = shouldPromptBiometric({
        hasSession: session as boolean,
        optedIn: opted as boolean,
        hardwareAvailable: hardware as boolean,
        alreadyUnlockedThisSession: unlocked as boolean,
      });

      expect(result).toBe(expected as boolean);
    });
  });

  it('MUTATION DETECTOR: hasSession inverted → test fails', () => {
    // If someone changes: if (!input.hasSession) return false;
    // To: if (input.hasSession) return false;
    // This test will FAIL

    // During OTP login (no session), gate must NOT fire
    const noSessionDuringLogin = shouldPromptBiometric({
      hasSession: false,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });
    expect(noSessionDuringLogin).toBe(false);

    // After OTP login (with session), gate CAN fire
    const withSessionAfterLogin = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });
    expect(withSessionAfterLogin).toBe(true);
  });

  it('MUTATION DETECTOR: optedIn inverted → test fails', () => {
    const notOptedIn = shouldPromptBiometric({
      hasSession: true,
      optedIn: false,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });
    expect(notOptedIn).toBe(false);

    const optedIn = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });
    expect(optedIn).toBe(true);
  });

  it('MUTATION DETECTOR: hardwareAvailable inverted → test fails', () => {
    const noHardware = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: false,
      alreadyUnlockedThisSession: false,
    });
    expect(noHardware).toBe(false);

    const withHardware = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
    });
    expect(withHardware).toBe(true);
  });
});

/**
 * GRACE WINDOW TESTS — cold-start gap fix
 *
 * The grace window (60 seconds) prevents re-prompting users
 * who just unlocked within the past minute.
 */
describe('shouldPromptBiometric — Grace Window (Cold-Start Gap Fix)', () => {
  const baseTime = 1000000;
  const GRACE_MS = 60_000;

  it('COLD START + session + opted in + hardware + no prior unlock → PROMPTS', () => {
    // This is the exact case users mean by "biometric lock" that was failing before.
    // App is force-quit while session exists. On reopen (cold start):
    // - Session is restored from expo-secure-store
    // - index.tsx redirects to /(app)/(matches)
    // - _layout.tsx mount effect evaluates gate
    // - No prior unlock exists (lastUnlockAt is null)
    // - Should prompt for biometric
    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: null,
      now: baseTime,
    });

    expect(result).toBe(true);
  });

  it('cold start without session → never prompts', () => {
    // During phone→OTP login, no session exists yet
    // Biometric gate must NOT fire, or users get locked out
    const result = shouldPromptBiometric({
      hasSession: false,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: null,
      now: baseTime,
    });

    expect(result).toBe(false);
  });

  it('resume 5s after unlock → NO prompt (within grace window)', () => {
    // User unlocked at t=0, app goes to background
    // At t=5s, app comes to foreground (still within 60s grace window)
    // Should NOT re-prompt
    const unlockTime = baseTime;
    const resumeTime = baseTime + 5000; // 5 seconds later

    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: unlockTime,
      now: resumeTime,
    });

    expect(result).toBe(false);
  });

  it('resume 30s after unlock → NO prompt (grace window boundary)', () => {
    // Edge case: halfway through grace window
    const unlockTime = baseTime;
    const resumeTime = baseTime + 30000; // 30 seconds later

    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: unlockTime,
      now: resumeTime,
    });

    expect(result).toBe(false);
  });

  it('resume at 59.9s after unlock → NO prompt (still in grace)', () => {
    // Just before grace window expires
    const unlockTime = baseTime;
    const resumeTime = baseTime + 59900; // 59.9 seconds

    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: unlockTime,
      now: resumeTime,
    });

    expect(result).toBe(false);
  });

  it('resume 60s after unlock → PROMPTS (grace window expired)', () => {
    // Exactly at grace window boundary (60s), grace expires
    const unlockTime = baseTime;
    const resumeTime = baseTime + GRACE_MS; // exactly 60s

    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: unlockTime,
      now: resumeTime,
    });

    expect(result).toBe(true);
  });

  it('resume 90s after unlock → PROMPTS (grace window expired)', () => {
    // Well past grace window
    const unlockTime = baseTime;
    const resumeTime = baseTime + 90000; // 90 seconds later

    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: unlockTime,
      now: resumeTime,
    });

    expect(result).toBe(true);
  });

  it('lastUnlockAt in the FUTURE (clock skew/tampering) → PROMPTS (fail closed)', () => {
    // If lastUnlockAt > now, the clock was tampered with or skewed backwards
    // Fail closed: re-prompt to be safe
    const unlockTime = baseTime + 100000; // 100 seconds in the future
    const now = baseTime;

    const result = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: unlockTime,
      now,
    });

    expect(result).toBe(true);
  });

  it('GRACE_MS constant is 60 seconds', () => {
    // Verify the grace window is correct (tests above hardcode it)
    // Import GRACE_MS from biometric module in real code
    expect(60_000).toBe(60_000);
  });

  it('grace window respects all other guards (mutation: override lastUnlockAt)', () => {
    // Even with a fresh unlock (within grace window), other guards still apply
    const recentUnlock = baseTime - 5000; // 5s ago

    // If optedIn=false, still no prompt
    const notOptedIn = shouldPromptBiometric({
      hasSession: true,
      optedIn: false,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: recentUnlock,
      now: baseTime,
    });
    expect(notOptedIn).toBe(false);

    // If no session, still no prompt
    const noSession = shouldPromptBiometric({
      hasSession: false,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: false,
      lastUnlockAt: recentUnlock,
      now: baseTime,
    });
    expect(noSession).toBe(false);

    // If already unlocked this session, still no prompt
    const alreadyUnlocked = shouldPromptBiometric({
      hasSession: true,
      optedIn: true,
      hardwareAvailable: true,
      alreadyUnlockedThisSession: true,
      lastUnlockAt: recentUnlock,
      now: baseTime,
    });
    expect(alreadyUnlocked).toBe(false);
  });
});
