export interface TenantProvisioningRequest {
  readonly slug: string;
  readonly region: string;
  readonly environment: string;
  readonly databaseHost: string;
  readonly databasePort: number;
  readonly databaseName: string;
  readonly credentialsReference: string;
  readonly tenantId?: string;
  readonly provisionIdempotencyKey?: string;
}

export interface TenantProvisioningResult {
  readonly tenantId: string;
  readonly databaseName: string;
  readonly databaseUsername: string;
  readonly status: 'PROVISIONING' | 'ACTIVE' | 'FAILED';
  readonly defaultOrganizationId?: string;
  readonly provisioningStep?: string;
}

export interface TenantDeprovisionOptions {
  /** When true, DROP DATABASE + DROP ROLE after closing pools. Soft path only flips status. */
  readonly hard?: boolean;
}

export interface TenantDatabaseProvisionerPort {
  /**
   * Ensures control-plane tenant row exists (PROVISIONING) and returns tenantId.
   * Idempotent when provisionIdempotencyKey or slug already maps to a row.
   */
  registerTenant(request: TenantProvisioningRequest): Promise<{ tenantId: string; created: boolean }>;

  /**
   * CREATE DATABASE + ROLE + grants CONNECT. Does not delete the tenant row on failure.
   */
  createDatabaseInfrastructure(tenantId: string): Promise<{ databaseName: string; databaseUsername: string }>;

  /**
   * Runs tenant migrations then grants schema privileges. Does not delete the tenant row on failure.
   */
  migrateAndGrant(tenantId: string): Promise<void>;

  /**
   * Legacy one-shot provision (register + infra + migrate). Prefer orchestrator steps.
   */
  provision(request: TenantProvisioningRequest): Promise<TenantProvisioningResult>;

  deprovision(tenantId: string, options?: TenantDeprovisionOptions): Promise<void>;
}

export const TENANT_DATABASE_PROVISIONER_PORT = Symbol('TENANT_DATABASE_PROVISIONER_PORT');

export interface TenantDatabaseMigratorPort {
  migrate(tenantId: string): Promise<void>;
  migrateAll(): Promise<void>;
}

export const TENANT_DATABASE_MIGRATOR_PORT = Symbol('TENANT_DATABASE_MIGRATOR_PORT');

export interface TenantDatabaseHealthCheckerPort {
  check(tenantId: string): Promise<{ healthy: boolean; latencyMs: number }>;
}

export const TENANT_DATABASE_HEALTH_CHECKER_PORT = Symbol('TENANT_DATABASE_HEALTH_CHECKER_PORT');
