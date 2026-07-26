import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import RootGate from '../index';
import { useSession } from '../../hooks/useSession';
import { fetchSessionDirect } from '../../lib/auth-client';

/**
 * RootGate is the boot gate that a release APK once hung on forever. These
 * tests lock in the property that matters: it ALWAYS leaves the spinner —
 * navigating on the happy path, and, when the session hook wedges, falling back
 * to a direct fetch that either resolves the boot or surfaces a retry screen.
 */

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../hooks/useSession', () => ({ useSession: jest.fn() }));
jest.mock('../../lib/auth-client', () => ({ fetchSessionDirect: jest.fn() }));

const mockReplace = jest.fn();
const mockUseSession = useSession as jest.Mock;
const mockFetchDirect = fetchSessionDirect as jest.Mock;

// RNTL v14 render is async under React 19 — commit it inside an awaited act so
// effects (navigation, fallback) have run before we assert.
const renderGate = async () => {
  await act(async () => {
    render(<RootGate />);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RootGate', () => {
  it('shows the loading view while the session is pending', async () => {
    mockUseSession.mockReturnValue({ isPending: true, data: null, error: null });

    await renderGate();

    expect(screen.getByText('Getting things ready')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('navigates to Matches when the hook resolves with a user', async () => {
    mockUseSession.mockReturnValue({
      isPending: false,
      data: { user: { id: 'u1' } },
      error: null,
    });

    await renderGate();

    expect(mockReplace).toHaveBeenCalledWith('/(app)/(matches)');
  });

  it('navigates to phone login when the hook resolves with no user', async () => {
    mockUseSession.mockReturnValue({ isPending: false, data: null, error: null });

    await renderGate();

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/phone');
  });

  it('falls back to a direct fetch when the hook never settles, then navigates', async () => {
    mockUseSession.mockReturnValue({ isPending: true, data: null, error: null });
    mockFetchDirect.mockResolvedValue({ user: { id: 'u1' } });

    await renderGate();

    // Hook is still pending — advance past the grace window to trip the
    // fallback. advanceTimersByTimeAsync flushes the resolved fetch's
    // microtasks between ticks, so it stays inside a single awaited act.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(6000);
    });

    expect(mockFetchDirect).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/(matches)');
  });

  it('shows the error screen when the fallback fetch fails, and retries', async () => {
    mockUseSession.mockReturnValue({ isPending: true, data: null, error: null });
    mockFetchDirect
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ user: null });

    await renderGate();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(6000);
    });

    expect(screen.getByText("Couldn't connect")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();

    // Retry re-runs the direct fetch (a bare state reset would not refetch).
    await act(async () => {
      fireEvent.press(screen.getByText('Try again'));
    });

    expect(mockFetchDirect).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/phone');
  });

  it('falls back to a direct fetch when the hook reports an error', async () => {
    mockUseSession.mockReturnValue({
      isPending: false,
      data: null,
      error: new Error('hook store failed'),
    });
    mockFetchDirect.mockResolvedValue({ user: { id: 'u1' } });

    await renderGate();

    expect(mockFetchDirect).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/(matches)');
  });
});
