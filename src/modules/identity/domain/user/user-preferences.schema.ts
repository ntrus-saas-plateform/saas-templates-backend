/**
 * User preference keys stored in tenant DB `user_preferences.settings`.
 * Flat dotted keys so they overlay ConfigurationResolver userSettings.
 */
import { z, ZodError } from 'zod';

const localeSchema = z.string().min(2).max(16);
const timezoneSchema = z.string().min(1).max(64);
const themeSchema = z.enum(['system', 'light', 'dark']);
const densitySchema = z.enum(['comfortable', 'compact']);
const currencyDisplaySchema = z.enum(['symbol', 'code', 'name']);

export const USER_PREFERENCE_SCHEMAS: Record<string, z.ZodType> = {
  'localization.locale': localeSchema,
  'localization.timezone': timezoneSchema,
  'localization.dateFormat': z.string().min(1).max(32),
  'localization.timeFormat': z.enum(['12h', '24h']),
  'currency.display': currencyDisplaySchema,
  'ui.theme': themeSchema,
  'ui.density': densitySchema,
  'ui.sidebarCollapsed': z.boolean(),
  'ui.reducedMotion': z.boolean(),
  'defaults.applicationId': z.string().max(100).nullable(),
  'defaults.organizationId': z.string().uuid().nullable(),
  'defaults.dashboardId': z.string().max(100).nullable(),
  'defaults.landingPage': z.string().max(200).nullable(),
  'tables.pageSize': z.number().int().min(5).max(100),
  'tables.columnPreferences': z.record(z.string(), z.unknown()),
  'tables.savedViews': z.array(z.unknown()),
  'notifications.inApp.enabled': z.boolean(),
  'notifications.email.enabled': z.boolean(),
  'notifications.sms.enabled': z.boolean(),
  'notifications.push.enabled': z.boolean(),
  'notifications.whatsapp.enabled': z.boolean(),
  'notifications.digest': z.enum(['off', 'daily', 'weekly']),
  'notifications.frequency': z.enum(['realtime', 'hourly', 'daily']),
  'notifications.quietHours': z
    .object({
      enabled: z.boolean().optional(),
      start: z.string().max(8).optional(),
      end: z.string().max(8).optional(),
    })
    .passthrough(),
  'notifications.categories': z.record(z.string(), z.boolean()),
  'ui.atlasTheme': z.string().min(3).max(64),
  'accessibility.reducedMotion': z.boolean(),
  'accessibility.keyboardShortcuts': z.boolean(),
  'accessibility.textScale': z.enum(['normal', 'large', 'xlarge']),
  'accessibility.highContrast': z.boolean(),
  'accessibility.dyslexiaMode': z.boolean(),
  'accessibility.largeCursor': z.boolean(),
  'accessibility.underlineLinks': z.boolean(),
  'accessibility.fabEdge': z.enum(['left', 'right']),
  'accessibility.fabY': z.coerce.number(),
  'accessibility.fabPosition': z
    .object({
      edge: z.enum(['left', 'right']),
      y: z.number(),
    })
    .passthrough(),
  /**
   * Phone KYC result (OTP-verified only). Writable via identity phone OTP
   * use cases — not via PATCH /users/me/preferences.
   */
  'verification.phoneVerified': z.boolean(),
  'verification.phoneE164': z.string().max(32).nullable(),
  /** Nested blob (favorites, pins, widgets, saved views) — see user-personalization.ts */
  personalization: z.record(z.string(), z.unknown()),
};

/** Keys managed by KYC / identity flows — rejected on preference PATCH. */
const PREFERENCE_PATCH_BLOCKED = new Set([
  'verification.phoneVerified',
  'verification.phoneE164',
]);

export function validateUserPreferencePatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (PREFERENCE_PATCH_BLOCKED.has(key) || key.startsWith('verification.')) {
      throw new ZodError([
        {
          code: 'custom',
          path: [key],
          message:
            'Phone verification is managed via OTP (POST /users/me/identity/phone/*), not preferences',
        },
      ]);
    }
    const schema = USER_PREFERENCE_SCHEMAS[key];
    if (!schema) {
      // Allow namespaced JSON blobs under known prefixes for forward compat
      if (
        key === 'personalization' ||
        key.startsWith('tables.') ||
        key.startsWith('notifications.') ||
        key.startsWith('defaults.') ||
        key.startsWith('ui.') ||
        key.startsWith('localization.') ||
        key.startsWith('currency.') ||
        key.startsWith('accessibility.')
      ) {
        out[key] = value;
        continue;
      }
      continue;
    }
    out[key] = schema.parse(value);
  }
  return out;
}
