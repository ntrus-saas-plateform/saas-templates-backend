import type { Tenant, TenantProvisioningStep } from '../tenant/tenant.entity.js';
import type { TenantStatus } from '../tenant/tenant.entity.js';
import type { TenantProfileUpdate } from '../tenant/tenant-profile.js';

export interface TenantProvisioningProgressUpdate {
  status?: TenantStatus;
  provisioningStep?: TenantProvisioningStep | null;
  failureReason?: string | null;
  failureStep?: string | null;
  lastAttemptAt?: Date | null;
  retryCount?: number;
  defaultOrganizationId?: string | null;
  planId?: string | null;
}

export interface TenantAdminPort {
  findById(tenantId: string): Promise<Tenant | null>;
  findByProvisionIdempotencyKey(key: string): Promise<Tenant | null>;
  updateProvisioningProgress(
    tenantId: string,
    update: TenantProvisioningProgressUpdate,
  ): Promise<Tenant>;
  updateProfile(tenantId: string, update: TenantProfileUpdate): Promise<Tenant>;
  transitionStatus(tenantId: string, status: TenantStatus): Promise<Tenant>;
  getOwnerIdentityId(tenantId: string, client?: unknown): Promise<string | null>;
  setOwner(tenantId: string, identityId: string, client?: unknown): Promise<void>;
  /**
   * Atomically transfers ownership when the expected owner still holds the tenant.
   * Returns false if another actor already changed ownership (concurrent transfer).
   */
  transferOwnership(
    tenantId: string,
    expectedOwnerIdentityId: string | null,
    newOwnerIdentityId: string,
    client?: unknown,
  ): Promise<boolean>;
}

export const TENANT_ADMIN_PORT = Symbol('TENANT_ADMIN_PORT');
