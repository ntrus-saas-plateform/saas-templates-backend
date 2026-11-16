import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ServiceOperationsRepositoryPort } from '../../domain/platform-operations/operations-repository.port.js';
import {
  ApproveChangeUseCase,
  ExecuteAutomationUseCase,
  IngestOperationalAlertUseCase,
  TransitionIncidentUseCase,
  VerifyRecoveryUseCase,
} from './operations.use-cases.js';

function outboxStub() {
  return {
    runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, e: unknown) => unknown) =>
      fn({}, vi.fn()),
    ),
  };
}

describe('P9 operations use-cases', () => {
  it('IngestOperationalAlertUseCase returns deduplicated path', async () => {
    const alert = {
      id: 'a1',
      fingerprint: 'fp-1',
      title: 'High CPU',
      occurrenceCount: 2,
      status: 'ACTIVE',
    };
    const repo = {
      ingestAlert: vi.fn().mockResolvedValue({ alert, deduplicated: true }),
    } as unknown as ServiceOperationsRepositoryPort;
    const audit = { create: vi.fn() };
    const uc = new IngestOperationalAlertUseCase(repo, outboxStub() as never, audit as never);
    const result = await uc.execute({
      actorId: '10000000-0000-4000-8000-000000000001',
      fingerprint: 'fp-1',
      title: 'High CPU',
      sourceSystem: 'prometheus.cluster',
    });
    expect(result.deduplicated).toBe(true);
    expect(result.alert.occurrenceCount).toBe(2);
    expect(audit.create).toHaveBeenCalled();
  });

  it('TransitionIncidentUseCase enforces policy', async () => {
    const repo = {
      getIncident: vi.fn().mockResolvedValue({
        id: 'i1',
        status: 'CLOSED',
        version: 1,
      }),
      transitionIncident: vi.fn(),
      addIncidentTimeline: vi.fn(),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new TransitionIncidentUseCase(repo, outboxStub() as never, { create: vi.fn() } as never);
    await expect(
      uc.execute({
        actorId: 'actor',
        incidentId: 'i1',
        toStatus: 'MITIGATING',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('ApproveChangeUseCase rejects self-approval (SoD)', async () => {
    const repo = {
      getChange: vi.fn().mockResolvedValue({
        id: 'c1',
        status: 'SUBMITTED',
        requesterId: 'same-user',
        version: 1,
      }),
      transitionChange: vi.fn(),
      approveChange: vi.fn(),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new ApproveChangeUseCase(repo, outboxStub() as never, { create: vi.fn() } as never);
    await expect(
      uc.execute({ actorId: 'same-user', changeId: 'c1' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('VerifyRecoveryUseCase requires evidence', async () => {
    const repo = {
      getRecovery: vi.fn().mockResolvedValue({ id: 'r1', status: 'EXECUTING' }),
      transitionRecovery: vi.fn(),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new VerifyRecoveryUseCase(repo, outboxStub() as never, { create: vi.fn() } as never);
    await expect(
      uc.execute({
        actorId: 'actor',
        recoveryId: 'r1',
        externalEvidenceRef: '',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('ExecuteAutomationUseCase blocks unapproved destructive automation', async () => {
    const repo = {
      getAutomationExecution: vi.fn().mockResolvedValue({
        id: 'e1',
        automationId: 'auto-1',
        status: 'REQUESTED',
        approvedBy: null,
        idempotencyKey: 'k1',
      }),
      getAutomation: vi.fn().mockResolvedValue({
        id: 'auto-1',
        destructive: true,
        requiresApproval: true,
      }),
      executeAutomation: vi.fn(),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new ExecuteAutomationUseCase(repo, outboxStub() as never, { create: vi.fn() } as never);
    await expect(
      uc.execute({ actorId: 'actor', executionId: 'e1' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});
