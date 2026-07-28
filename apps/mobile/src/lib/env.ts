/**
 * Environment configuration for the mobile app.
 *
 * On Android emulator, use 10.0.2.2 instead of localhost to reach the host machine.
 * On physical devices and iOS simulator, use the actual server hostname/IP.
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Base URL for user-uploaded media (profile photos), served from the Cloudflare
 * R2 bucket behind this CDN host. Photo keys are appended directly:
 * `${MEDIA_BASE_URL}/${photoKey}`. Baked in at build time via eas.json so a
 * release APK points at production, not a placeholder.
 */
export const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_URL ?? 'https://pub-7636b4a54e624991aabbe56292aff185.r2.dev';
