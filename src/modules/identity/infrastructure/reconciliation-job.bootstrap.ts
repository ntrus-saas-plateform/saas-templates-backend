import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG } from '../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../shared/configuration/environment.schema.js';
import { JOB_SCHEDULER_PORT } from '../../../core/domain/ports/job-scheduler.port.js';
import type { JobSchedulerPort } from '../../../core/domain/ports/job-scheduler.port.js';
import { TENANT_REGISTRY_PORT } from '../domain/ports/tenant-registry.port.js';
import type { TenantRegistryPort } from '../domain/ports/tenant-registry.port.js';
import { RECONCILIATION_REPORT_REPOSITORY_PORT } from '../domain/ports/reconciliation-report-repository.port.js';
import type { ReconciliationReportRepositoryPort } from '../domain/ports/reconciliation-report-repository.port.js';
import { LoggerService } from '../../../shared/logging/logger.service.js';
import { ReconcileKeycloakUseCase } from '../application/reconciliation/reconcile-keycloak.use-case.js';
import { IdentityMetricsService } from '../../../shared/observability/identity-metrics.service.js';
import type { ReconcileKeycloakResult } from '../domain/reconciliation/reconciliation-report.entity.js';

function recordReconciliationDrifts(metrics: IdentityMetricsService, report: ReconcileKeycloakResult): void {
  for (const drift of report.drifts) {
    metrics.recordReconciliationDrift(drift.type);
  }
}

@Injectable()
export class ReconciliationJobBootstrap implements OnModuleInit {
  constructor(
    @Inject(JOB_SCHEDULER_PORT) private readonly scheduler: JobSchedulerPort,
    @Inject(TENANT_REGISTRY_PORT) private readonly tenantRegistry: TenantRegistryPort,
    private readonly reconcileKeycloak: ReconcileKeycloakUseCase,
    @Inject(RECONCILIATION_REPORT_REPOSITORY_PORT)
    private readonly reportRepository: ReconciliationReportRepositoryPort,
    private readonly logger: LoggerService,
    private readonly identityMetrics: IdentityMetricsService,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.RECONCILIATION_JOB_ENABLED) return;

    this.scheduler.register({
      name: 'keycloak-reconciliation',
      cronExpression: `every:${this.config.RECONCILIATION_JOB_INTERVAL_SECONDS}s`,
      handler: async () => {
        const tenantIds = await this.tenantRegistry.listActiveTenantIds();
        for (const tenantId of tenantIds) {
          try {
            const report = await this.reconcileKeycloak.execute({ tenantId, repair: false });
            recordReconciliationDrifts(this.identityMetrics, report);
            await this.reportRepository.save(report);
          } catch (error) {
            this.logger.error(
              `Reconciliation job failed for tenant ${tenantId}`,
              error instanceof Error ? error : undefined,
            );
          }
        }
      },
    });
  }
}
