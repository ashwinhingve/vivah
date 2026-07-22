/**
 * Gate WIRING tests — when the gate is evaluated, not what it decides.
 *
 * The decision logic is covered in lib/__tests__/biometric.test.ts. This file
 * covers the part that was previously untested and where the cold-start bug
 * actually lived: whether the gate is evaluated on mount at all, versus only on
 * an AppState foreground transition.
 */
import { renderHook, render, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useBiometricGate } from '../useBiometricGate';
import {
  canUseBiometric,
  isBiometricEnabled,
  getLastUnlockAt,
} from '@/lib/biometric';

jest.mock('@/lib/biometric', () => ({
  ...jest.requireActual('@/lib/biometric'),
  canUseBiometric: jest.fn(),
  isBiometricEnabled: jest.fn(),
  getLastUnlockAt: jest.fn(),
}));

const mockCanUse = canUseBiometric as jest.MockedFunction<typeof canUseBiometric>;
const mockOptedIn = isBiometricEnabled as jest.MockedFunction<typeof isBiometricEnabled>;
const mockLastUnlock = getLastUnlockAt as jest.MockedFunction<typeof getLastUnlockAt>;

/** Happy path: enrolled hardware, opted in, never unlocked. */
function armed() {
  mockCanUse.mockResolvedValue({ canUse: true });
  mockOptedIn.mockResolvedValue(true);
  mockLastUnlock.mockResolvedValue(null);
}

describe('useBiometricGate — wiring', () => {
  beforeEach(() => jest.clearAllMocks());

  it('COLD START: prompts on mount with a stored session, without any AppState event', async () => {
    armed();
    const onPrompt = jest.fn();

    renderHook(() =>
      useBiometricGate({ hasSession: true, sessionLoading: false, onPrompt }),
    );

    // No background→foreground transition is emitted anywhere in this test.
    // Before the fix the gate only ran inside the AppState handler, so this
    // assertion is the regression guard for the cold-start hole.
    await waitFor(() => expect(onPrompt).toHaveBeenCalledTimes(1));
  });

  it('does not prompt while the session is still loading', async () => {
    armed();
    const onPrompt = jest.fn();

    renderHook(() =>
      useBiometricGate({ hasSession: false, sessionLoading: true, onPrompt }),
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it('LOGIN REGRESSION GUARD: never prompts without a session', async () => {
    armed();
    const onPrompt = jest.fn();

    renderHook(() =>
      useBiometricGate({ hasSession: false, sessionLoading: false, onPrompt }),
    );

    await new Promise((r) => setTimeout(r, 20));
    // If this fires, the gate interposes on phone→OTP and locks every user out.
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it('evaluates when the session arrives in a later render than isPending clearing', async () => {
    armed();
    const onPrompt = jest.fn();

    // A probe component rather than renderHook's rerender, which RNTL v14 does
    // not expose here.
    function Probe({ hasSession }: { hasSession: boolean }) {
      useBiometricGate({ hasSession, sessionLoading: false, onPrompt });
      return null;
    }

    // RNTL v14 render is async — destructuring it unawaited yields undefined.
    const { rerender } = await render(<Probe hasSession={false} />);

    await new Promise((r) => setTimeout(r, 20));
    expect(onPrompt).not.toHaveBeenCalled();

    // Session data lands one render later — the effect must re-evaluate, or the
    // gate silently never fires.
    rerender(<Probe hasSession={true} />);
    await waitFor(() => expect(onPrompt).toHaveBeenCalledTimes(1));
  });

  it('re-arms on background → foreground', async () => {
    armed();
    const onPrompt = jest.fn();
    let handler: ((s: string) => void) | undefined;

    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, cb: (s: string) => void) => {
      handler = cb;
      return { remove: jest.fn() };
    }) as never);

    renderHook(() =>
      useBiometricGate({ hasSession: true, sessionLoading: false, onPrompt }),
    );
    await waitFor(() => expect(onPrompt).toHaveBeenCalledTimes(1));

    // Unlocked just now → grace window suppresses the next evaluation.
    mockLastUnlock.mockResolvedValue(Date.now());
    await act(async () => {
      handler?.('background');
      handler?.('active');
    });
    expect(onPrompt).toHaveBeenCalledTimes(1);

    // Grace expired → prompts again on the next foreground.
    mockLastUnlock.mockResolvedValue(Date.now() - 120_000);
    await act(async () => {
      handler?.('background');
      handler?.('active');
    });
    await waitFor(() => expect(onPrompt).toHaveBeenCalledTimes(2));
  });

  it('does not prompt when the device has no enrolled biometrics', async () => {
    mockCanUse.mockResolvedValue({ canUse: false, reason: 'not_enrolled' });
    mockOptedIn.mockResolvedValue(true);
    mockLastUnlock.mockResolvedValue(null);
    const onPrompt = jest.fn();

    renderHook(() =>
      useBiometricGate({ hasSession: true, sessionLoading: false, onPrompt }),
    );

    await new Promise((r) => setTimeout(r, 20));
    // Never strand a user at a prompt their device cannot satisfy.
    expect(onPrompt).not.toHaveBeenCalled();
  });
});
