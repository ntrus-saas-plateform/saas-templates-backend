import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type { TenantAdminPort, TenantProvisioningProgressUpdate } from '../../domain/ports/tenant-admin.port.js';
import type { Tenant, TenantStatus } from '../../domain/tenant/tenant.entity.js';
import {
  TENANT_PROFILE_COLUMN_MAP,
  TENANT_SELECT_COLUMNS,
  type TenantProfileUpdate,
} from '../../domain/tenant/tenant-profile.js';
import { mapTenantRow, type TenantRow } from '../../domain/tenant/tenant-row.mapper.js';
import { assertTenantTransition } from '../../domain/tenant/tenant-lifecycle.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

@Injectable()
export class PgTenantAdminRepository implements TenantAdminPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async findById(tenantId: string): Promise<Tenant | null> {
    const result = await this.pool.query<TenantRow>(
      `SELECT ${TENANT_SELECT_COLUMNS} FROM tenants WHERE id = $1 AND status != 'DELETED'`,
      [tenantId],
    );
    return result.rows[0] ? mapTenantRow(result.rows[0]) : null;
  }

  async findByProvisionIdempotencyKey(key: string): Promise<Tenant | null> {
    const result = await this.pool.query<TenantRow>(
      `SELECT ${TENANT_SELECT_COLUMNS} FROM tenants WHERE provision_idempotency_key = $1`,
      [key],
    );
    return result.rows[0] ? mapTenantRow(result.rows[0]) : null;
  }

  async updateProvisioningProgress(
    tenantId: string,
    update: TenantProvisioningProgressUpdate,
  ): Promise<Tenant> {
    const fields: string[] = [];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (update.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(update.status);
    }
    if (update.provisioningStep !== undefined) {
      fields.push(`provisioning_step = $${idx++}`);
      values.push(update.provisioningStep);
    }
    if (update.failureReason !== undefined) {
      fields.push(`failure_reason = $${idx++}`);
      values.push(update.failureReason);
    }
    if (update.failureStep !== undefined) {
      fields.push(`failure_step = $${idx++}`);
      values.push(update.failureStep);
    }
    if (update.lastAttemptAt !== undefined) {
      fields.push(`last_attempt_at = $${idx++}`);
      values.push(update.lastAttemptAt);
    }
    if (update.retryCount !== undefined) {
      fields.push(`retry_count = $${idx++}`);
      values.push(update.retryCount);
    }
    if (update.defaultOrganizationId !== undefined) {
      fields.push(`default_organization_id = $${idx++}`);
      values.push(update.defaultOrganizationId);
    }
    if (update.planId !== undefined) {
      fields.push(`plan_id = $${idx++}`);
      values.push(update.planId);
    }

    if (fields.length === 0) {
      const tenant = await this.findById(tenantId);
      if (!tenant) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found');
      return tenant;
    }

    fields.push('updated_at = NOW()');
    const result = await this.pool.query<TenantRow>(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $1
       RETURNING ${TENANT_SELECT_COLUMNS}`,
      values,
    );
    if (!result.rows[0]) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found');
    return mapTenantRow(result.rows[0]);
  }

  async updateProfile(tenantId: string, update: TenantProfileUpdate): Promise<Tenant> {
    const fields: string[] = [];
    const values: unknown[] = [tenantId];
    let idx = 2;

    for (const [key, column] of Object.entries(TENANT_PROFILE_COLUMN_MAP)) {
      const value = update[key as keyof TenantProfileUpdate];
      if (value !== undefined) {
        fields.push(`${column} = $${idx}`);
        values.push(key === 'legalIdentifiers' ? JSON.stringify(value) : value);
        idx++;
      }
    }

    if (fields.length === 0) {
      const tenant = await this.findById(tenantId);
      if (!tenant) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found');
      return tenant;
    }

    fields.push('updated_at = NOW()');
    const result = await this.pool.query<TenantRow>(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $1
       RETURNING ${TENANT_SELECT_COLUMNS}`,
      values,
    );
    if (!result.rows[0]) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found');
    return mapTenantRow(result.rows[0]);
  }

  async transitionStatus(tenantId: string, status: TenantStatus): Promise<Tenant> {
    const current = await this.findById(tenantId);
    if (!current) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found');
    assertTenantTransition(current.status, status);

    const result = await this.pool.query<TenantRow>(
      `UPDATE tenants SET status = $2, updated_at = NOW() WHERE id = $1
       RETURNING ${TENANT_SELECT_COLUMNS}`,
      [tenantId, status],
    );
    if (!result.rows[0]) throw new DomainError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found');
    return mapTenantRow(result.rows[0]);
  }

  async getOwnerIdentityId(tenantId: string, client?: unknown): Promise<string | null> {
    const executor = client ? (client as PoolClient) : this.pool;
    const result = await executor.query<{ identity_id: string }>(
      `SELECT identity_id FROM tenant_owners WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows[0]?.identity_id ?? null;
  }

  async setOwner(tenantId: string, identityId: string, client?: unknown): Promise<void> {
    const executor = client ? (client as PoolClient) : this.pool;
    await executor.query(
      `INSERT INTO tenant_owners (tenant_id, identity_id) VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET identity_id = EXCLUDED.identity_id, assigned_at = NOW()`,
      [tenantId, identityId],
    );
  }

  async transferOwnership(
    tenantId: string,
    expectedOwnerIdentityId: string | null,
    newOwnerIdentityId: string,
    client?: unknown,
  ): Promise<boolean> {
    const executor = client ? (client as PoolClient) : this.pool;

    if (expectedOwnerIdentityId) {
      const result = await executor.query(
        `UPDATE tenant_owners
         SET identity_id = $3, assigned_at = NOW()
         WHERE tenant_id = $1 AND identity_id = $2
         RETURNING tenant_id`,
        [tenantId, expectedOwnerIdentityId, newOwnerIdentityId],
      );
      return (result.rowCount ?? 0) > 0;
    }

    const insertResult = await executor.query(
      `INSERT INTO tenant_owners (tenant_id, identity_id)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO NOTHING
       RETURNING tenant_id`,
      [tenantId, newOwnerIdentityId],
    );
    return (insertResult.rowCount ?? 0) > 0;
  }

  private get pool() {
    return this.dbManager.getControlPlanePool();
  }
}
