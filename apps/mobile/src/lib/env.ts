/**
 * Environment configuration for the mobile app.
 *
 * On Android emulator, use 10.0.2.2 instead of localhost to reach the host machine.
 * On physical devices and iOS simulator, use the actual server hostname/IP.
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
