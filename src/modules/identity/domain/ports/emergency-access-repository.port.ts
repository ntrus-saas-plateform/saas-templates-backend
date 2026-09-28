import type { EmergencyAccessGrant } from '../delegation/emergency-access-grant.entity.js';

export interface CreateEmergencyAccessParams {
  tenantId: string;
  organizationId: string | null;
  operatorIdentityId: string;
  approvedByIdentityId: string;
  reason: string;
  scope: Readonly<Record<string, unknown>>;
  expiresAt: Date;
}

export interface EmergencyAccessRepositoryPort {
  create(params: CreateEmergencyAccessParams): Promise<EmergencyAccessGrant>;
  findByTenant(tenantId: string): Promise<readonly EmergencyAccessGrant[]>;
  findByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly EmergencyAccessGrant[]; total: number }>;
  revoke(tenantId: string, id: string): Promise<EmergencyAccessGrant>;
}

export const EMERGENCY_ACCESS_REPOSITORY_PORT = Symbol('EMERGENCY_ACCESS_REPOSITORY_PORT');
