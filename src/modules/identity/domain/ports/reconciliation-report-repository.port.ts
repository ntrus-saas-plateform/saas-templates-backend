import type { ReconcileKeycloakResult } from '../reconciliation/reconciliation-report.entity.js';

export interface ReconciliationReportRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly ranAt: Date;
  readonly keycloakAvailable: boolean;
  readonly report: ReconcileKeycloakResult;
  readonly createdAt: Date;
}

export interface ReconciliationReportRepositoryPort {
  save(report: ReconcileKeycloakResult): Promise<ReconciliationReportRecord>;
  findLatestByTenant(tenantId: string): Promise<ReconciliationReportRecord | null>;
  listByTenant(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ records: readonly ReconciliationReportRecord[]; total: number }>;
}

export const RECONCILIATION_REPORT_REPOSITORY_PORT = Symbol(
  'RECONCILIATION_REPORT_REPOSITORY_PORT',
);
