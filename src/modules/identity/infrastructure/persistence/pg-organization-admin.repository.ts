import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  OrganizationAdminPort,
  CreateOrganizationParams,
  UpdateOrganizationParams,
} from '../../domain/ports/organization-admin.port.js';
import {
  OrganizationStatus,
  OrganizationType,
  type Organization,
} from '../../domain/organization/organization.entity.js';
import {
  ORGANIZATION_SELECT_COLUMNS,
  mapOrganizationRow,
  type OrganizationRow,
} from '../../domain/organization/organization-row.js';
import { assertOrganizationTransition } from '../../domain/organization/organization-lifecycle.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

@Injectable()
export class PgOrganizationAdminRepository implements OrganizationAdminPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async create(params: CreateOrganizationParams, client?: unknown): Promise<Organization> {
    const id = randomUUID();
    const keycloakId = params.keycloakOrganizationId ?? `kc-${id}`;
    const executor = this.getExecutor(client);
    const result = await executor.query<OrganizationRow>(
      `INSERT INTO organizations (
         id, tenant_id, keycloak_organization_id, name, slug, status, type, code, parent_id,
         is_primary, description, timezone, locale, address, contact, opening_hours,
         operational_settings, metadata
       ) VALUES (
         $1, $2, $3, $4, $5, 'ACTIVE', $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb,
         $15::jsonb, $16::jsonb, $17::jsonb
       )
       RETURNING ${ORGANIZATION_SELECT_COLUMNS}`,
      [
        id,
        params.tenantId,
        keycloakId,
        params.name,
        params.slug,
        params.type ?? OrganizationType.OTHER,
        params.code ?? null,
        params.parentId ?? null,
        params.isPrimary ?? false,
        params.description ?? null,
        params.timezone ?? null,
        params.locale ?? null,
        JSON.stringify(params.address ?? {}),
        JSON.stringify(params.contact ?? {}),
        JSON.stringify(params.openingHours ?? {}),
        JSON.stringify(params.operationalSettings ?? {}),
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return mapOrganizationRow(result.rows[0]);
  }

  async update(
    tenantId: string,
    organizationId: string,
    params: UpdateOrganizationParams,
    client?: unknown,
  ): Promise<Organization> {
    const fields: string[] = [];
    const values: unknown[] = [tenantId, organizationId];
    let idx = 3;

    const scalarMapping: Array<[keyof UpdateOrganizationParams, string]> = [
      ['name', 'name'],
      ['slug', 'slug'],
      ['description', 'description'],
      ['timezone', 'timezone'],
      ['locale', 'locale'],
      ['type', 'type'],
      ['code', 'code'],
      ['parentId', 'parent_id'],
      ['isPrimary', 'is_primary'],
    ];

    for (const [key, column] of scalarMapping) {
      const value = params[key];
      if (value !== undefined) {
        fields.push(`${column} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    const jsonMapping: Array<[keyof UpdateOrganizationParams, string]> = [
      ['address', 'address'],
      ['contact', 'contact'],
      ['openingHours', 'opening_hours'],
      ['operationalSettings', 'operational_settings'],
      ['metadata', 'metadata'],
    ];

    for (const [key, column] of jsonMapping) {
      const value = params[key];
      if (value !== undefined) {
        fields.push(`${column} = $${idx}::jsonb`);
        values.push(JSON.stringify(value));
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No fields to update');
    }

    fields.push('updated_at = NOW()');
    const executor = this.getExecutor(client);
    const result = await executor.query<OrganizationRow>(
      `UPDATE organizations SET ${fields.join(', ')}
       WHERE tenant_id = $1 AND id = $2
       RETURNING ${ORGANIZATION_SELECT_COLUMNS}`,
      values,
    );
    if (!result.rows[0]) {
      throw new DomainError(ErrorCode.ORGANIZATION_NOT_FOUND, 'Organization not found');
    }
    return mapOrganizationRow(result.rows[0]);
  }

  async transitionStatus(
    tenantId: string,
    organizationId: string,
    status: OrganizationStatus,
    client?: unknown,
  ): Promise<Organization> {
    const executor = this.getExecutor(client);
    const current = await executor.query<OrganizationRow>(
      `SELECT ${ORGANIZATION_SELECT_COLUMNS}
       FROM organizations WHERE tenant_id = $1 AND id = $2`,
      [tenantId, organizationId],
    );
    if (!current.rows[0]) {
      throw new DomainError(ErrorCode.ORGANIZATION_NOT_FOUND, 'Organization not found');
    }
    assertOrganizationTransition(current.rows[0].status, status);

    const result = await executor.query<OrganizationRow>(
      `UPDATE organizations SET status = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING ${ORGANIZATION_SELECT_COLUMNS}`,
      [tenantId, organizationId, status],
    );
    return mapOrganizationRow(result.rows[0]);
  }

  async updateKeycloakOrganizationId(
    tenantId: string,
    organizationId: string,
    keycloakOrganizationId: string,
    client?: unknown,
  ): Promise<Organization> {
    const executor = this.getExecutor(client);
    const result = await executor.query<OrganizationRow>(
      `UPDATE organizations SET keycloak_organization_id = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING ${ORGANIZATION_SELECT_COLUMNS}`,
      [tenantId, organizationId, keycloakOrganizationId],
    );
    if (!result.rows[0]) {
      throw new DomainError(ErrorCode.ORGANIZATION_NOT_FOUND, 'Organization not found');
    }
    return mapOrganizationRow(result.rows[0]);
  }

  async clearPrimary(
    tenantId: string,
    exceptOrganizationId?: string | null,
    client?: unknown,
  ): Promise<void> {
    const executor = this.getExecutor(client);
    if (exceptOrganizationId) {
      await executor.query(
        `UPDATE organizations SET is_primary = false, updated_at = NOW()
         WHERE tenant_id = $1 AND id <> $2 AND is_primary = true`,
        [tenantId, exceptOrganizationId],
      );
      return;
    }
    await executor.query(
      `UPDATE organizations SET is_primary = false, updated_at = NOW()
       WHERE tenant_id = $1 AND is_primary = true`,
      [tenantId],
    );
  }

  async getAncestorChain(
    tenantId: string,
    organizationId: string,
    client?: unknown,
  ): Promise<readonly string[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query<{ id: string }>(
      `WITH RECURSIVE ancestors AS (
         SELECT id, parent_id, 0 AS depth
         FROM organizations
         WHERE tenant_id = $1 AND id = $2
         UNION ALL
         SELECT o.id, o.parent_id, a.depth + 1
         FROM organizations o
         INNER JOIN ancestors a ON o.id = a.parent_id
         WHERE o.tenant_id = $1 AND a.depth < 32
       )
       SELECT id FROM ancestors ORDER BY depth`,
      [tenantId, organizationId],
    );
    return result.rows.map((r) => r.id);
  }

  private getExecutor(client?: unknown) {
    return client ? (client as PoolClient) : this.dbManager.getControlPlanePool();
  }
}
