export enum TenantStatus {
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  READ_ONLY = 'READ_ONLY',
  DEACTIVATING = 'DEACTIVATING',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
  FAILED = 'FAILED',
  LOCKED = 'LOCKED',
}

/** Ordered saga steps for tenant provisioning. */
export enum TenantProvisioningStep {
  REQUESTED = 'REQUESTED',
  DB_CREATED = 'DB_CREATED',
  MIGRATED = 'MIGRATED',
  IDENTITY_CONFIGURED = 'IDENTITY_CONFIGURED',
  ORG_CONFIGURED = 'ORG_CONFIGURED',
  ADMIN_CONFIGURED = 'ADMIN_CONFIGURED',
  READY = 'READY',
}

export interface TenantDatabaseConfig {
  host: string;
  port: number;
  name: string;
  /** PostgreSQL LOGIN role; falls back to CONTROL_PLANE_DB_USER when null (legacy rows). */
  username: string | null;
  credentialsReference: string;
}

export interface Tenant {
  readonly id: string;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly database: TenantDatabaseConfig;
  readonly region: string;
  readonly environment: string;
  readonly legalName: string | null;
  readonly displayName: string | null;
  readonly tradeName: string | null;
  readonly description: string | null;
  readonly companyType: string | null;
  readonly industry: string | null;
  readonly registrationNumber: string | null;
  readonly taxId: string | null;
  readonly commerceRegister: string | null;
  readonly legalIdentifiers: Record<string, unknown>;
  readonly logoUrl: string | null;
  readonly logoCompactUrl: string | null;
  readonly faviconUrl: string | null;
  readonly country: string | null;
  readonly adminRegion: string | null;
  readonly city: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly postalCode: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly timezone: string;
  readonly locale: string;
  readonly defaultCurrency: string;
  readonly defaultLanguage: string;
  readonly dateFormat: string;
  readonly timeFormat: string;
  readonly numberFormat: string;
  readonly fiscalCalendar: string;
  readonly fiscalYearStartMonth: number;
  readonly fiscalYearStartDay: number;
  readonly primaryContactName: string | null;
  readonly primaryContactEmail: string | null;
  readonly primaryContactPhone: string | null;
  readonly planReference: string | null;
  /** FK to plans table; supersedes free-text planReference when set. */
  readonly planId: string | null;
  readonly maxOrganizationsOverride: number | null;
  readonly maxUsersOverride: number | null;
  readonly maxCustomersOverride: number | null;
  readonly maxProductsOverride: number | null;
  /**
   * @deprecated Unused. Single shared Keycloak realm; tenants use Keycloak Organizations.
   */
  readonly keycloakRealm: string | null;
  readonly provisioningStep: TenantProvisioningStep | null;
  readonly failureReason: string | null;
  readonly failureStep: string | null;
  readonly lastAttemptAt: Date | null;
  readonly retryCount: number;
  readonly defaultOrganizationId: string | null;
  readonly primaryEstablishmentId: string | null;
  readonly referenceOrganizationId: string | null;
  readonly provisionIdempotencyKey: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function isTenantAccessible(
  status: TenantStatus,
  opts?: { allowSuspendedReads?: boolean },
): boolean {
  if (status === TenantStatus.ACTIVE || status === TenantStatus.READ_ONLY) return true;
  if (status === TenantStatus.SUSPENDED && opts?.allowSuspendedReads) return true;
  return false;
}

export function isTenantWritable(status: TenantStatus): boolean {
  return status === TenantStatus.ACTIVE;
}
