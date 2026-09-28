export const TENANT_SETTINGS_RESOURCES_PORT = Symbol('TENANT_SETTINGS_RESOURCES_PORT');

export type NumberPreview = { preview: string; nextValue: number };

export interface TenantSettingsResourcesPort {
  list(tenantId: string, table: string): Promise<Record<string, unknown>[]>;
  getById(tenantId: string, table: string, id: string): Promise<Record<string, unknown> | null>;
  insert(
    tenantId: string,
    table: string,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  update(
    tenantId: string,
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
  remove(tenantId: string, table: string, id: string): Promise<boolean>;
  previewNumber(tenantId: string, sequenceId: string): Promise<NumberPreview | null>;
  nextNumber(tenantId: string, sequenceId: string): Promise<NumberPreview | null>;
  listAuditLogs(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      action?: string;
      resource?: string;
      from?: string;
      to?: string;
    },
  ): Promise<{ items: Record<string, unknown>[]; total: number }>;
}
