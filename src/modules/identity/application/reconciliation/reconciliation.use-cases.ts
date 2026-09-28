import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { ReconciliationReportRepositoryPort } from '../../domain/ports/reconciliation-report-repository.port.js';
import type { ReconcileKeycloakResult } from '../../domain/reconciliation/reconciliation-report.entity.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';
import { ReconcileKeycloakUseCase } from '../reconciliation/reconcile-keycloak.use-case.js';

export class RunReconciliationUseCase
  implements UseCase<{ ctx: ExecutionContext; repair?: boolean }, ReconcileKeycloakResult>
{
  constructor(
    private readonly reconcileKeycloak: ReconcileKeycloakUseCase,
    private readonly reportRepository: ReconciliationReportRepositoryPort,
  ) {}

  async execute(input: { ctx: ExecutionContext; repair?: boolean }): Promise<ReconcileKeycloakResult> {
    const report = await this.reconcileKeycloak.execute({
      tenantId: input.ctx.tenantId,
      repair: input.repair ?? false,
    });
    await this.reportRepository.save(report);
    return report;
  }
}

export class GetReconciliationReportUseCase
  implements UseCase<{ ctx: ExecutionContext }, ReconcileKeycloakResult | null>
{
  constructor(private readonly reportRepository: ReconciliationReportRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext }): Promise<ReconcileKeycloakResult | null> {
    const record = await this.reportRepository.findLatestByTenant(input.ctx.tenantId);
    return record?.report ?? null;
  }
}

export class ListReconciliationReportsUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; page?: number; limit?: number },
      PaginatedResult<ReconcileKeycloakResult>
    >
{
  constructor(private readonly reportRepository: ReconciliationReportRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ReconcileKeycloakResult>> {
    requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const { records, total } = await this.reportRepository.listByTenant(
      input.ctx.tenantId,
      page,
      limit,
    );
    return {
      data: records.map((r) => r.report),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }
}
