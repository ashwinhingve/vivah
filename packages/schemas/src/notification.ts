import { z } from 'zod';

/**
 * Notification preferences — channel master switches + per-event opt-out list.
 * Mirrors the `notification_preferences` table. All fields optional so a PATCH
 * can update a single toggle. `mutedTypes` holds job-level NotificationType
 * strings the user has opted out of.
 */
export const NotificationPrefsSchema = z.object({
  push:       z.boolean().optional(),
  sms:        z.boolean().optional(),
  email:      z.boolean().optional(),
  inApp:      z.boolean().optional(),
  marketing:  z.boolean().optional(),
  mutedTypes: z.array(z.string()).optional(),
});

/** Push-token registration for the `device_tokens` table. */
export const RegisterDeviceSchema = z.object({
  token:      z.string().min(10),
  platform:   z.enum(['ios', 'android', 'web']),
  appVersion: z.string().optional(),
});

/** Query params for GET /me/notifications. */
export const NotificationListQuerySchema = z.object({
  limit:      z.coerce.number().int().min(1).max(200).default(50),
  unreadOnly: z.coerce.boolean().default(false),
  category:   z.string().optional(),
});

export type NotificationPrefsInput     = z.infer<typeof NotificationPrefsSchema>;
export type RegisterDeviceInput        = z.infer<typeof RegisterDeviceSchema>;
export type NotificationListQueryInput = z.infer<typeof NotificationListQuerySchema>;
