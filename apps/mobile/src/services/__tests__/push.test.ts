// Mock dependencies BEFORE importing the module
jest.mock('react-native-css-interop', () => ({
  getColorScheme: jest.fn(() => 'light'),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('../../lib/api', () => ({
  api: {
    users: {
      registerDevice: jest.fn(),
      unregisterDevice: jest.fn(),
    },
  },
}));

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '../../lib/api';
import {
  initializePush,
  unregisterPush,
  getPushToken,
} from '../push';

describe('push service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips initialization on simulator', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(false);

    await initializePush();

    expect(api.users.registerDevice).not.toHaveBeenCalled();
  });

  it('requests permission on device', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });
    (api.users.registerDevice as jest.Mock).mockResolvedValue(undefined);

    await initializePush();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(api.users.registerDevice).toHaveBeenCalledWith({
      token: 'ExponentPushToken[abc123]',
      platform: 'ios',
      appVersion: '1.0.0',
    });
  });

  it('skips permission request if already granted', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });
    (api.users.registerDevice as jest.Mock).mockResolvedValue(undefined);

    await initializePush();

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(api.users.registerDevice).toHaveBeenCalled();
  });

  it('handles permission denial gracefully', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    await initializePush();

    expect(api.users.registerDevice).not.toHaveBeenCalled();
  });

  it('handles token fetch failure gracefully', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: null,
    });

    await initializePush();

    expect(api.users.registerDevice).not.toHaveBeenCalled();
  });

  it('handles API registration failure gracefully', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });
    (api.users.registerDevice as jest.Mock).mockRejectedValue(
      new Error('Network error'),
    );

    // Should not throw
    await expect(initializePush()).resolves.not.toThrow();
    expect(api.users.registerDevice).toHaveBeenCalled();
  });

  it('is idempotent', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });
    (api.users.registerDevice as jest.Mock).mockResolvedValue(undefined);

    await initializePush();
    await initializePush();

    // Should only register once
    expect(api.users.registerDevice).toHaveBeenCalledTimes(1);
  });

  it('unregisters device on sign-out', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });
    (api.users.registerDevice as jest.Mock).mockResolvedValue(undefined);
    (api.users.unregisterDevice as jest.Mock).mockResolvedValue(undefined);

    await initializePush();
    await unregisterPush();

    expect(api.users.unregisterDevice).toHaveBeenCalledWith(
      'ExponentPushToken[abc123]',
    );
  });

  it('handles unregister failure gracefully', async () => {
    (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });
    (api.users.registerDevice as jest.Mock).mockResolvedValue(undefined);
    (api.users.unregisterDevice as jest.Mock).mockRejectedValue(
      new Error('Network error'),
    );

    await initializePush();

    // Should not throw
    await expect(unregisterPush()).resolves.not.toThrow();
  });

  it('returns null token if not initialized', () => {
    const token = getPushToken();
    expect(token).toBe(null);
  });
});
