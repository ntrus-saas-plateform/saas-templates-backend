export interface UserPreferencesPort {
  getActiveOrganization(tenantId: string, userId: string): Promise<string | null>;

  upsertActiveOrganization(
    tenantId: string,
    userId: string,
    organizationId: string,
    client?: unknown,
  ): Promise<void>;

  getSettings(tenantId: string, userId: string): Promise<Record<string, unknown>>;

  /** Merge patch into settings JSONB (flat dotted keys). */
  patchSettings(
    tenantId: string,
    userId: string,
    patch: Record<string, unknown>,
    client?: unknown,
    organizationId?: string | null,
  ): Promise<Record<string, unknown>>;
}

export const USER_PREFERENCES_PORT = Symbol('USER_PREFERENCES_PORT');
