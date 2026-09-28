import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type {
  ReconciliationReportRepositoryPort,
  ReconciliationReportRecord,
} from '../../domain/ports/reconciliation-report-repository.port.js';
import type { ReconcileKeycloakResult } from '../../domain/reconciliation/reconciliation-report.entity.js';

interface ReportRow {
  id: string;
  tenant_id: string;
  ran_at: Date;
  keycloak_available: boolean;
  report: ReconcileKeycloakResult;
  created_at: Date;
}

@Injectable()
export class PgReconciliationReportRepository implements ReconciliationReportRepositoryPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async save(report: ReconcileKeycloakResult): Promise<ReconciliationReportRecord> {
    const pool = this.dbManager.getControlPlanePool();
    const id = randomUUID();
    const result = await pool.query<ReportRow>(
      `INSERT INTO reconciliation_reports (id, tenant_id, ran_at, keycloak_available, report)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, tenant_id, ran_at, keycloak_available, report, created_at`,
      [
        id,
        report.tenantId,
        new Date(report.ranAt),
        report.keycloakAvailable,
        JSON.stringify(report),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findLatestByTenant(tenantId: string): Promise<ReconciliationReportRecord | null> {
    const pool = this.dbManager.getControlPlanePool();
    const result = await pool.query<ReportRow>(
      `SELECT id, tenant_id, ran_at, keycloak_available, report, created_at
       FROM reconciliation_reports
       WHERE tenant_id = $1
       ORDER BY ran_at DESC
       LIMIT 1`,
      [tenantId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listByTenant(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ records: readonly ReconciliationReportRecord[]; total: number }> {
    const pool = this.dbManager.getControlPlanePool();
    const offset = (page - 1) * limit;
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reconciliation_reports WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const result = await pool.query<ReportRow>(
      `SELECT id, tenant_id, ran_at, keycloak_available, report, created_at
       FROM reconciliation_reports
       WHERE tenant_id = $1
       ORDER BY ran_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return { records: result.rows.map((row) => this.mapRow(row)), total };
  }

  private mapRow(row: ReportRow): ReconciliationReportRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ranAt: row.ran_at,
      keycloakAvailable: row.keycloak_available,
      report: row.report,
      createdAt: row.created_at,
    };
  }
}
