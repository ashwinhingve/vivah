/**
 * Push registration tests.
 *
 * Deliberately does NOT mock `react-native`. An earlier version replaced the
 * whole module, which broke the jest-expo preset's own setup and stopped this
 * suite loading at all ("Cannot use import statement outside a module" from
 * deep inside expo-modules-core). `push.ts` needs only `Platform`, which the
 * preset already provides; mocking the three modules that genuinely touch
 * native code is enough, and it keeps the real module graph intact.
 *
 * Scope note: these prove the REGISTRATION CONTRACT — permission gating, token
 * hand-off to the API, and that nothing throws. They cannot prove a
 * notification is ever delivered. That needs a dev-client build on real
 * hardware and is still outstanding.
 */
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

/**
 * Stable object shared across `jest.isolateModules` re-requires. Returning a
 * fresh literal from the factory instead would silently reset `isDevice` to
 * true on every isolated require, so the simulator case could never be tested.
 */
const mockDevice = { isDevice: true };
jest.mock('expo-device', () => mockDevice);

jest.mock('../../lib/api', () => ({
  api: {
    users: {
      registerDevice: jest.fn(),
      unregisterDevice: jest.fn(),
    },
  },
}));

import * as Notifications from 'expo-notifications';
import { api } from '../../lib/api';

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const getToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const registerDevice = api.users.registerDevice as jest.Mock;
const unregisterDevice = api.users.unregisterDevice as jest.Mock;

/**
 * push.ts holds module-level state (isInitialized, token) and initializePush is
 * idempotent by design, so every test needs a fresh module instance — otherwise
 * the first test's initialisation makes every later one a silent no-op.
 */
function freshPush(): typeof import('../push') {
  let mod!: typeof import('../push');
  // require inside the sync isolateModules, not `await import()`: dynamic import
  // needs --experimental-vm-modules, which this jest run does not enable.
  jest.isolateModules(() => {
    mod = require('../push') as typeof import('../push');
  });
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  registerDevice.mockResolvedValue({ ok: true });
  unregisterDevice.mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('initializePush', () => {
  it('registers the token with the API when permission is already granted', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' });
    getToken.mockResolvedValue({ data: 'ExponentPushToken[abc123]' });

    const push = freshPush();
    await push.initializePush();

    expect(registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'ExponentPushToken[abc123]' }),
    );
    expect(push.getPushToken()).toBe('ExponentPushToken[abc123]');
    // Already granted — must not re-prompt the user.
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('prompts for permission when not yet granted, then registers', async () => {
    getPermissions.mockResolvedValue({ status: 'undetermined' });
    requestPermissions.mockResolvedValue({ status: 'granted' });
    getToken.mockResolvedValue({ data: 'ExponentPushToken[xyz]' });

    const push = freshPush();
    await push.initializePush();

    expect(requestPermissions).toHaveBeenCalled();
    expect(registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'ExponentPushToken[xyz]' }),
    );
  });

  it('does not register when the user denies permission', async () => {
    getPermissions.mockResolvedValue({ status: 'undetermined' });
    requestPermissions.mockResolvedValue({ status: 'denied' });

    const push = freshPush();
    await push.initializePush();

    // Registering a device the user refused would send push they never allowed.
    expect(registerDevice).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(push.getPushToken()).toBeNull();
  });

  it('no-ops on a simulator rather than throwing', async () => {
    mockDevice.isDevice = false;
    try {
      const push = freshPush();
      // Expo Go and simulators cannot issue push tokens. Startup calls this, so
      // anything worse than a silent no-op here bricks the app on a simulator.
      await expect(push.initializePush()).resolves.toBeUndefined();

      expect(getPermissions).not.toHaveBeenCalled();
      expect(registerDevice).not.toHaveBeenCalled();
    } finally {
      mockDevice.isDevice = true;
    }
  });

  it('is idempotent — a second call does not register twice', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' });
    getToken.mockResolvedValue({ data: 'ExponentPushToken[once]' });

    const push = freshPush();
    await push.initializePush();
    await push.initializePush();

    expect(registerDevice).toHaveBeenCalledTimes(1);
  });

  it('swallows an API failure instead of crashing app startup', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' });
    getToken.mockResolvedValue({ data: 'ExponentPushToken[boom]' });
    registerDevice.mockRejectedValue(new Error('500'));

    const push = freshPush();

    // Push is not worth taking the app down for; it must degrade silently.
    await expect(push.initializePush()).resolves.toBeUndefined();
  });

  it('swallows a token-retrieval failure', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' });
    getToken.mockRejectedValue(new Error('no token service'));

    const push = freshPush();

    await expect(push.initializePush()).resolves.toBeUndefined();
    expect(registerDevice).not.toHaveBeenCalled();
  });
});

describe('unregisterPush', () => {
  it('unregisters the stored token and clears it', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' });
    getToken.mockResolvedValue({ data: 'ExponentPushToken[bye]' });

    const push = freshPush();
    await push.initializePush();
    await push.unregisterPush();

    // Leaving a stale token registered means a shared handset keeps receiving
    // the previous user's notifications after they sign out.
    expect(unregisterDevice).toHaveBeenCalledWith('ExponentPushToken[bye]');
    expect(push.getPushToken()).toBeNull();
  });

  it('is a no-op when there is no token', async () => {
    const push = freshPush();

    await expect(push.unregisterPush()).resolves.toBeUndefined();
    expect(unregisterDevice).not.toHaveBeenCalled();
  });
});
