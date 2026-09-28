export interface SettingsRepositoryPort {
  getTenantSetting(tenantId: string, namespace: string, key: string): Promise<unknown | null>;
  listTenantNamespace(tenantId: string, namespace: string): Promise<Readonly<Record<string, unknown>>>;
  setTenantSetting(
    tenantId: string,
    namespace: string,
    key: string,
    value: unknown,
    sensitivity?: string,
    client?: unknown,
  ): Promise<void>;

  getOrganizationSetting(
    tenantId: string,
    organizationId: string,
    namespace: string,
    key: string,
  ): Promise<unknown | null>;
  listOrganizationNamespace(
    tenantId: string,
    organizationId: string,
    namespace: string,
  ): Promise<Readonly<Record<string, unknown>>>;
  setOrganizationSetting(
    tenantId: string,
    organizationId: string,
    namespace: string,
    key: string,
    value: unknown,
    client?: unknown,
  ): Promise<void>;
}

export const SETTINGS_REPOSITORY_PORT = Symbol('SETTINGS_REPOSITORY_PORT');
