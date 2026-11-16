import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  RequestLifecycleDeprovisionUseCase,
  RequestLifecycleResumeUseCase,
  RequestLifecycleSuspendUseCase,
} from '../../application/tenant-lifecycle/lifecycle.use-cases.js';
import type {
  TenantTechnicalLifecycleBridgeInput,
  TenantTechnicalLifecycleBridgeOutcome,
  TenantTechnicalLifecycleBridgePort,
} from '../../domain/tenant-management/tenant-technical-lifecycle-bridge.port.js';

@Injectable()
export class P7TenantTechnicalLifecycleBridge implements TenantTechnicalLifecycleBridgePort {
  constructor(
    private readonly requestSuspend: RequestLifecycleSuspendUseCase,
    private readonly requestResume: RequestLifecycleResumeUseCase,
    private readonly requestDeprovision: RequestLifecycleDeprovisionUseCase,
  ) {}

  private wrap(
    run: () => Promise<{ workflow?: { id?: string } | null }>,
  ): Promise<TenantTechnicalLifecycleBridgeOutcome> {
    return run()
      .then((result) => ({
        workflowId: result.workflow?.id ?? null,
        outcome: 'STARTED' as const,
      }))
      .catch((err: unknown) => {
        if (err instanceof DomainError && err.code === ErrorCode.RESOURCE_NOT_FOUND) {
          return { workflowId: null, outcome: 'SKIPPED_NO_RECORD' as const };
        }
        const message = err instanceof Error ? err.message : String(err);
        return { workflowId: null, outcome: 'FAILED' as const, error: message };
      });
  }

  async requestSuspend(
    input: TenantTechnicalLifecycleBridgeInput,
  ): Promise<TenantTechnicalLifecycleBridgeOutcome> {
    return this.wrap(() =>
      this.requestSuspend.execute({
        actorId: input.actorId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        lifecycleRecordId: input.lifecycleRecordId,
        reason: input.reason ?? null,
      }),
    );
  }

  async requestResume(
    input: TenantTechnicalLifecycleBridgeInput,
  ): Promise<TenantTechnicalLifecycleBridgeOutcome> {
    return this.wrap(() =>
      this.requestResume.execute({
        actorId: input.actorId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        lifecycleRecordId: input.lifecycleRecordId,
        reason: input.reason ?? null,
      }),
    );
  }

  async requestDeprovision(
    input: TenantTechnicalLifecycleBridgeInput & {
      authorized: boolean;
      confirmed: boolean;
    },
  ): Promise<TenantTechnicalLifecycleBridgeOutcome> {
    const reason = (input.reason ?? '').trim() || 'P8 lifecycle approval delegation';
    return this.wrap(() =>
      this.requestDeprovision.execute({
        actorId: input.actorId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        lifecycleRecordId: input.lifecycleRecordId,
        authorized: input.authorized,
        confirmed: input.confirmed,
        reason,
      }),
    );
  }
}