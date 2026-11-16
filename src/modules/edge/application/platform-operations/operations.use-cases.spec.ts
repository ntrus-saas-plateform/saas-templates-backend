import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ServiceOperationsRepositoryPort } from '../../domain/platform-operations/operations-repository.port.js';
import {
  ApproveChangeUseCase,
  ConnectMonitoringSourceUseCase,
  ExecuteAutomationUseCase,
  IngestOperationalAlertUseCase,
  RecordMonitoringProbeResultUseCase,
  TransitionIncidentUseCase,
  TransitionReleaseUseCase,
  UpdateNotificationDeliveryStatusUseCase,
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

  it('VerifyRecoveryUseCase requires evidenceKind and strong ref', async () => {
    const repo = {
      getRecovery: vi.fn().mockResolvedValue({ id: 'r1', status: 'EXECUTING' }),
      transitionRecovery: vi.fn().mockResolvedValue({ id: 'r1', status: 'VERIFIED' }),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new VerifyRecoveryUseCase(repo, outboxStub() as never, { create: vi.fn() } as never);
    await expect(
      uc.execute({
        actorId: 'actor',
        recoveryId: 'r1',
        externalEvidenceRef: '',
        evidenceKind: 'PROVIDER_TICKET',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    await expect(
      uc.execute({
        actorId: 'actor',
        recoveryId: 'r1',
        externalEvidenceRef: 'ticket-abcdef12',
        evidenceKind: 'PROVIDER_TICKET',
      }),
    ).resolves.toMatchObject({ status: 'VERIFIED' });
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

  it('UpdateNotificationDeliveryStatusUseCase rejects illegal QUEUED→DELIVERED skip', async () => {
    const repo = {
      getNotificationDelivery: vi.fn().mockResolvedValue({
        id: 'n1',
        status: 'QUEUED',
        providerRef: null,
        attempts: 0,
      }),
      updateNotificationDeliveryStatus: vi.fn(),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new UpdateNotificationDeliveryStatusUseCase(
      repo,
      outboxStub() as never,
      { create: vi.fn() } as never,
    );
    await expect(
      uc.execute({
        actorId: 'actor',
        deliveryId: 'n1',
        toStatus: 'DELIVERED',
        providerRef: 'msg-123',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(repo.updateNotificationDeliveryStatus).not.toHaveBeenCalled();
  });

  it('TransitionReleaseUseCase rejects DEPLOYED without digest/evidence', async () => {
    const repo = {
      getRelease: vi.fn().mockResolvedValue({
        id: 'rel-1',
        status: 'PROMOTING',
        artifactDigest: null,
        externalEvidenceRef: null,
      }),
      transitionRelease: vi.fn(),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new TransitionReleaseUseCase(repo, outboxStub() as never, { create: vi.fn() } as never);
    await expect(
      uc.execute({
        actorId: 'actor',
        releaseId: 'rel-1',
        toStatus: 'DEPLOYED',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(repo.transitionRelease).not.toHaveBeenCalled();
  });

  it('ConnectMonitoringSourceUseCase yields CONFIGURED only', async () => {
    const repo = {
      connectMonitoringSource: vi.fn().mockResolvedValue({
        id: 'src-1',
        code: 'prom-1',
        status: 'CONFIGURED',
      }),
    } as unknown as ServiceOperationsRepositoryPort;
    const audit = { create: vi.fn() };
    const uc = new ConnectMonitoringSourceUseCase(repo, outboxStub() as never, audit as never);
    const result = await uc.execute({
      actorId: 'actor',
      code: 'prom-1',
      displayName: 'Prometheus',
      providerType: 'PROMETHEUS',
    });
    expect(result.status).toBe('CONFIGURED');
  });

  it('RecordMonitoringProbeResultUseCase promotes CONNECTED only after UP probe', async () => {
    const repo = {
      getMonitoringSource: vi.fn().mockResolvedValue({
        id: 'src-1',
        status: 'CONFIGURED',
      }),
      recordMonitoringProbeResult: vi.fn().mockResolvedValue({
        id: 'p1',
        sourceId: 'src-1',
        outcome: 'UP',
        observedAt: new Date(),
      }),
      updateMonitoringSourceStatus: vi.fn().mockResolvedValue({
        id: 'src-1',
        status: 'CONNECTED',
      }),
    } as unknown as ServiceOperationsRepositoryPort;
    const uc = new RecordMonitoringProbeResultUseCase(
      repo,
      outboxStub() as never,
      { create: vi.fn() } as never,
    );
    const result = await uc.execute({
      actorId: 'actor',
      sourceId: 'src-1',
      probeType: 'HTTP',
      outcome: 'UP',
    });
    expect(repo.updateMonitoringSourceStatus).toHaveBeenCalledWith(
      'src-1',
      'CONNECTED',
      expect.any(Object),
      expect.anything(),
    );
    expect(result.source.status).toBe('CONNECTED');
  });
});
