import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../lib/api';

/**
 * Push notification service.
 *
 * Handles:
 * - Requesting user permission
 * - Obtaining device token from expo-notifications
 * - Registering token with the API
 * - Cleaning up on sign-out
 *
 * Safety: all operations NO-OP gracefully if push is unavailable
 * (simulator, Expo Go, or platform restrictions). The service must
 * never crash app startup.
 */

interface PushServiceState {
  token: string | null;
  isInitialized: boolean;
}

let state: PushServiceState = {
  token: null,
  isInitialized: false,
};

/**
 * Request permission and initialize push notifications.
 * Safe to call multiple times; idempotent.
 * NO-OPS safely if device doesn't support push.
 */
export async function initializePush(): Promise<void> {
  if (state.isInitialized) return;
  state.isInitialized = true;

  // Simulator / Expo Go — no push
  if (!Device.isDevice) {
    console.log('[push] Not on physical device, skipping push initialization');
    return;
  }

  try {
    // Request permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[push] Permission not granted');
      return;
    }

    // Get the token
    const token = await Notifications.getExpoPushTokenAsync().then(
      (res) => res.data,
    );

    if (!token) {
      console.log('[push] Failed to obtain token');
      return;
    }

    state.token = token;

    // Register token with API
    const platform = Platform.OS as 'ios' | 'android' | 'web';
    await api.users.registerDevice({
      token,
      platform,
      appVersion: Constants.expoConfig?.version ?? '0.1.0',
    });

    console.log('[push] Initialized with token:', token.slice(0, 20) + '...');
  } catch (err) {
    console.error('[push] Initialization failed:', err);
    // Do not throw — push failure must not crash the app
  }
}

/**
 * Unregister the device token on sign-out.
 * Safe to call if not initialized.
 */
export async function unregisterPush(): Promise<void> {
  if (!state.token) return;

  try {
    await api.users.unregisterDevice(state.token);
    state.token = null;
    console.log('[push] Device unregistered');
  } catch (err) {
    console.error('[push] Unregister failed:', err);
    // Do not throw — best-effort cleanup
  }
}

/**
 * Get the current push token.
 * Returns null if not initialized or unavailable.
 */
export function getPushToken(): string | null {
  return state.token;
}
