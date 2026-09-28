import { z } from 'zod';

const pinItemSchema = z.object({
  id: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  href: z.string().min(1).max(500),
  icon: z.string().max(64).optional(),
});

const recentItemSchema = pinItemSchema.extend({
  at: z.string().datetime().optional(),
});

const widgetSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  hidden: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const PERSONALIZATION_DEFAULTS = {
  favorites: [] as unknown[],
  recentApplications: [] as unknown[],
  recentPages: [] as unknown[],
  pinnedPages: [] as unknown[],
  pinnedActions: [] as unknown[],
  dashboardLayout: [] as unknown[],
  widgets: [] as unknown[],
  hiddenWidgets: [] as string[],
  savedSearches: [] as unknown[],
  savedReports: [] as unknown[],
  savedFilters: [] as unknown[],
  savedTableViews: [] as unknown[],
};

export const personalizationSchema = z.object({
  favorites: z.array(pinItemSchema).max(50).optional(),
  recentApplications: z.array(recentItemSchema).max(30).optional(),
  recentPages: z.array(recentItemSchema).max(40).optional(),
  pinnedPages: z.array(pinItemSchema).max(30).optional(),
  pinnedActions: z.array(pinItemSchema).max(30).optional(),
  dashboardLayout: z.array(z.unknown()).max(100).optional(),
  widgets: z.array(widgetSchema).max(50).optional(),
  hiddenWidgets: z.array(z.string().max(100)).max(50).optional(),
  savedSearches: z.array(z.unknown()).max(50).optional(),
  savedReports: z.array(z.unknown()).max(50).optional(),
  savedFilters: z.array(z.unknown()).max(50).optional(),
  savedTableViews: z.array(z.unknown()).max(50).optional(),
});

export type UserPersonalization = z.infer<typeof personalizationSchema>;

export function parsePersonalization(raw: unknown): Record<string, unknown> {
  const base = { ...PERSONALIZATION_DEFAULTS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const parsed = personalizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ...base, ...(raw as Record<string, unknown>) };
  }
  return { ...base, ...parsed.data };
}

export function validatePersonalizationPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = personalizationSchema.partial().parse(patch);
  return parsed as Record<string, unknown>;
}
