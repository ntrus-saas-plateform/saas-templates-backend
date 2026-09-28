import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { DomainRegistryPort, CreateDomainParams } from '../../domain/ports/domain-registry.port.js';
import { DomainType, DomainStatus } from '../../domain/domain/tenant-domain.entity.js';
import type { TenantDomain } from '../../domain/domain/tenant-domain.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

interface DomainRow {
  id: string;
  tenant_id: string;
  hostname: string;
  type: string;
  is_primary: boolean;
  status: string;
  verification_token: string | null;
  verification_method: string;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLUMNS = `id, tenant_id, hostname, type, is_primary, status,
  verification_token, verification_method, verified_at, created_at, updated_at`;

@Injectable()
export class PgDomainRegistry implements DomainRegistryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findByHostname(hostname: string): Promise<TenantDomain | null> {
    const result = await this.pool.query<DomainRow>(
      `SELECT ${SELECT_COLUMNS} FROM tenant_domains WHERE hostname = $1 AND status = 'ACTIVE'`,
      [hostname],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findById(domainId: string, tenantId: string): Promise<TenantDomain | null> {
    const result = await this.pool.query<DomainRow>(
      `SELECT ${SELECT_COLUMNS} FROM tenant_domains WHERE id = $1 AND tenant_id = $2`,
      [domainId, tenantId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listByTenant(tenantId: string): Promise<readonly TenantDomain[]> {
    const result = await this.pool.query<DomainRow>(
      `SELECT ${SELECT_COLUMNS} FROM tenant_domains WHERE tenant_id = $1 ORDER BY is_primary DESC, created_at ASC`,
      [tenantId],
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  async create(params: CreateDomainParams): Promise<TenantDomain> {
    const type = params.type ?? DomainType.SUBDOMAIN;
    const isPrimary = params.isPrimary ?? false;
    // CUSTOM domains start as PENDING (require verification); SUBDOMAIN is platform-owned → ACTIVE
    const status = type === DomainType.CUSTOM ? DomainStatus.PENDING : DomainStatus.ACTIVE;

    try {
      const result = await this.pool.query<DomainRow>(
        `INSERT INTO tenant_domains (tenant_id, hostname, type, is_primary, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_COLUMNS}`,
        [params.tenantId, params.hostname, type, isPrimary, status],
      );
      return this.mapRow(result.rows[0]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/unique|duplicate/i.test(msg)) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `Hostname '${params.hostname}' is already registered`,
          [{ hostname: params.hostname }],
        );
      }
      throw error;
    }
  }

  async beginVerification(
    domainId: string,
    tenantId: string,
  ): Promise<{ token: string; txtName: string }> {
    const domain = await this.findById(domainId, tenantId);
    if (!domain) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Domain not found');
    }
    if (domain.status === DomainStatus.ACTIVE) {
      return {
        token: domain.verificationToken ?? '',
        txtName: `_platform-verify.${domain.hostname}`,
      };
    }
    const token = randomBytes(32).toString('hex');
    await this.pool.query(
      `UPDATE tenant_domains
       SET verification_token = $1, verification_method = 'DNS_TXT',
           status = 'PENDING', updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [token, domainId, tenantId],
    );
    return { token, txtName: `_platform-verify.${domain.hostname}` };
  }

  async markVerified(domainId: string, tenantId: string, token: string): Promise<TenantDomain> {
    const domain = await this.findById(domainId, tenantId);
    if (!domain) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Domain not found');
    }
    if (domain.status === DomainStatus.ACTIVE) {
      return domain;
    }
    if (!domain.verificationToken || domain.verificationToken !== token) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid verification token');
    }

    const txtName = `_platform-verify.${domain.hostname}`;
    let dnsOk = false;
    try {
      const records = await resolveTxt(txtName);
      const flat = records.flat().map((v) => v.replace(/^"|"$/g, '').trim());
      dnsOk = flat.includes(domain.verificationToken);
    } catch {
      dnsOk = false;
    }
    if (!dnsOk) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `DNS TXT record not found or mismatched at ${txtName}. Publish the verification token then retry.`,
      );
    }

    const result = await this.pool.query<DomainRow>(
      `UPDATE tenant_domains
       SET status = 'ACTIVE', verified_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [domainId, tenantId],
    );
    return this.mapRow(result.rows[0]);
  }

  async setPrimary(domainId: string, tenantId: string): Promise<void> {
    // Clear existing primary for tenant then set new one
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE tenant_domains SET is_primary = false, updated_at = NOW() WHERE tenant_id = $1`,
        [tenantId],
      );
      await client.query(
        `UPDATE tenant_domains SET is_primary = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [domainId, tenantId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async disable(domainId: string, tenantId: string): Promise<void> {
    await this.pool.query(
      `UPDATE tenant_domains SET status = 'DISABLED', is_primary = false, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [domainId, tenantId],
    );
  }

  private mapRow(row: DomainRow): TenantDomain {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      hostname: row.hostname,
      type: row.type as DomainType,
      isPrimary: row.is_primary,
      status: row.status as DomainStatus,
      verificationToken: row.verification_token,
      verificationMethod: row.verification_method ?? 'DNS_TXT',
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
