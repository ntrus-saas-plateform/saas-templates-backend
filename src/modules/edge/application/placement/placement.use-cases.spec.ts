import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  CancelPlacementUseCase,
  ConfirmPlacementUseCase,
  CreatePlacementRequestUseCase,
  EvaluatePlacementUseCase,
  ReleaseReservationUseCase,
} from './placement.use-cases.js';
import {
  CapacityReservationStatus,
  PlacementDecisionStatus,
  PlacementRequestStatus,
} from '../../domain/placement/placement.types.js';
import { PlacementDecisionStatus as PDS } from '../../domain/placement/placement.types.js';

const FAKE_CLIENT = { kind: 'tx-client' };

function outboxOk() {
  const enqueue = vi.fn(async () => 'outbox-id');
  return {
    enqueue,
    runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, enqueue: unknown) => Promise<unknown>) =>
      fn(FAKE_CLIENT, enqueue),
    ),
  };
}

function auditOk() {
  return { create: vi.fn(async () => undefined) };
}

const authReady = {
  requestId: 'prov-1',
  requestNumber: 'PR-1',
  requestStatus: 'ACCEPTED' as const,
  authorizationRowId: 'auth-row-1',
  authorizationId: 'auth-1',
  authorizationVersion: 1,
  accountId: 'acc-1',
  productId: 'prod-1',
  subscriptionId: 'sub-1',
  productTenantId: null,
  correlationId: 'corr-1',
  environmentSlot: 'PROD',
  entitlementSnapshotReference: 'ent-1',
  entitlementVersion: '1',
  payloadDigest: 'digest',
  expiresAt: new Date(Date.now() + 86_400_000),
  revocationStatus: 'NOT_REVOKED',
  verificationStatus: 'VERIFIED',
  decision: 'ALLOW',
};

describe('P7.3 placement use-cases', () => {
  it('refuses create when auth view is not placement-ready', async () => {
    const repo = { getRequestByIdempotencyKey: vi.fn(async () => null), createRequest: vi.fn() };
    const authView = { getPlacementReadyRequest: vi.fn(async () => null) };
    const registry = {};
    const uc = new CreatePlacementRequestUseCase(
      repo as never,
      authView as never,
      registry as never,
      outboxOk() as never,
      auditOk() as never,
    );
    await expect(
      uc.execute({
        actorId: 'a1',
        idempotencyKey: 'k1',
        provisioningRequestId: 'prov-1',
        productRegistryId: 'preg-1',
        technicalVersionId: 'tv-1',
        contractId: 'c-1',
        deploymentProfileId: 'dp-1',
        requestedEnvironmentType: 'PRODUCTION',
        requestedDeploymentModel: 'SHARED_SAAS',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(repo.createRequest).not.toHaveBeenCalled();
  });

  it('creates placement request atomically in a single runWithOutbox', async () => {
    const created = {
      id: 'pr-1',
      requestStatus: PlacementRequestStatus.PENDING,
      provisioningRequestId: 'prov-1',
    };
    const repo = {
      getRequestByIdempotencyKey: vi.fn(async () => null),
      createRequest: vi.fn(async () => created),
      appendHistory: vi.fn(async () => ({})),
    };
    const authView = { getPlacementReadyRequest: vi.fn(async () => authReady) };
    const registry = {
      getProductRegistry: vi.fn(async () => ({ id: 'preg-1' })),
      getTechnicalVersion: vi.fn(async () => ({ id: 'tv-1', productRegistryId: 'preg-1' })),
      getContract: vi.fn(async () => ({ id: 'c-1' })),
      getProfile: vi.fn(async () => ({ id: 'dp-1' })),
    };
    const outbox = outboxOk();
    const audit = auditOk();
    const uc = new CreatePlacementRequestUseCase(
      repo as never,
      authView as never,
      registry as never,
      outbox as never,
      audit as never,
    );
    const result = await uc.execute({
      actorId: 'a1',
      idempotencyKey: 'k1',
      provisioningRequestId: 'prov-1',
      productRegistryId: 'preg-1',
      technicalVersionId: 'tv-1',
      contractId: 'c-1',
      deploymentProfileId: 'dp-1',
      requestedEnvironmentType: 'PRODUCTION',
      requestedDeploymentModel: 'SHARED_SAAS',
      capacityRequirements: { TENANT_SLOT: 1 },
    });
    expect(result.id).toBe('pr-1');
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-1',
        productId: 'prod-1',
        subscriptionId: 'sub-1',
        authorizationRowId: 'auth-row-1',
      }),
      FAKE_CLIENT,
    );
    expect(repo.appendHistory).toHaveBeenCalledWith(expect.any(Object), FAKE_CLIENT);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'placement.request.created' }),
      FAKE_CLIENT,
    );
  });

  it('returns existing request on idempotent create without opening outbox twice', async () => {
    const existing = { id: 'pr-existing', requestStatus: PlacementRequestStatus.PENDING };
    const repo = {
      getRequestByIdempotencyKey: vi.fn(async () => existing),
      createRequest: vi.fn(),
    };
    const outbox = outboxOk();
    const uc = new CreatePlacementRequestUseCase(
      repo as never,
      { getPlacementReadyRequest: vi.fn() } as never,
      {} as never,
      outbox as never,
      auditOk() as never,
    );
    const result = await uc.execute({
      actorId: 'a1',
      idempotencyKey: 'k1',
      provisioningRequestId: 'prov-1',
      productRegistryId: 'preg-1',
      technicalVersionId: 'tv-1',
      contractId: 'c-1',
      deploymentProfileId: 'dp-1',
      requestedEnvironmentType: 'PRODUCTION',
      requestedDeploymentModel: 'SHARED_SAAS',
    });
    expect(result.id).toBe('pr-existing');
    expect(outbox.runWithOutbox).not.toHaveBeenCalled();
    expect(repo.createRequest).not.toHaveBeenCalled();
  });

  it('fails closed when audit is unavailable after create (rollback path)', async () => {
    const repo = {
      getRequestByIdempotencyKey: vi.fn(async () => null),
      createRequest: vi.fn(async () => ({
        id: 'pr-1',
        requestStatus: PlacementRequestStatus.PENDING,
      })),
      appendHistory: vi.fn(async () => ({})),
    };
    const authView = { getPlacementReadyRequest: vi.fn(async () => authReady) };
    const registry = {
      getProductRegistry: vi.fn(async () => ({ id: 'preg-1' })),
      getTechnicalVersion: vi.fn(async () => ({ id: 'tv-1', productRegistryId: 'preg-1' })),
      getContract: vi.fn(async () => ({ id: 'c-1' })),
      getProfile: vi.fn(async () => ({ id: 'dp-1' })),
    };
    const audit = {
      create: vi.fn(async () => {
        throw new Error('audit down');
      }),
    };
    const uc = new CreatePlacementRequestUseCase(
      repo as never,
      authView as never,
      registry as never,
      outboxOk() as never,
      audit as never,
    );
    await expect(
      uc.execute({
        actorId: 'a1',
        idempotencyKey: 'k-fail',
        provisioningRequestId: 'prov-1',
        productRegistryId: 'preg-1',
        technicalVersionId: 'tv-1',
        contractId: 'c-1',
        deploymentProfileId: 'dp-1',
        requestedEnvironmentType: 'PRODUCTION',
        requestedDeploymentModel: 'SHARED_SAAS',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.DEPENDENCY_UNAVAILABLE });
  });

  it('confirm commits reservation inside single runWithOutbox', async () => {
    const reservation = {
      id: 'res-1',
      version: 1,
      reservationStatus: CapacityReservationStatus.HELD,
    };
    const decision = {
      id: 'dec-1',
      decisionStatus: PlacementDecisionStatus.PLACED,
      capacityReservationId: 'res-1',
      version: 1,
    };
    const request = {
      id: 'pr-1',
      requestStatus: PlacementRequestStatus.PLACED,
      correlationId: 'corr-1',
      version: 2,
    };
    const repo = {
      getRequest: vi.fn(async () => request),
      listDecisions: vi.fn(async () => ({ items: [decision], total: 1 })),
      getReservation: vi.fn(async () => reservation),
      commitReservation: vi.fn(async () => ({
        ...reservation,
        reservationStatus: CapacityReservationStatus.COMMITTED,
        version: 2,
      })),
      appendHistory: vi.fn(async () => ({})),
    };
    const outbox = outboxOk();
    const audit = auditOk();
    const uc = new ConfirmPlacementUseCase(repo as never, outbox as never, audit as never);
    const result = await uc.execute({ actorId: 'a1', placementRequestId: 'pr-1' });
    expect(result.reservation.reservationStatus).toBe(CapacityReservationStatus.COMMITTED);
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.commitReservation).toHaveBeenCalledWith('res-1', 1, FAKE_CLIENT);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'placement.decision.confirmed' }),
      FAKE_CLIENT,
    );
  });

  it('cancel releases HELD reservations atomically', async () => {
    const request = {
      id: 'pr-1',
      requestStatus: PlacementRequestStatus.PLACED,
      correlationId: 'corr-1',
      version: 1,
    };
    const reservation = {
      id: 'res-1',
      version: 1,
      reservationStatus: CapacityReservationStatus.HELD,
    };
    const repo = {
      getRequest: vi.fn(async () => request),
      listReservations: vi.fn(async () => ({ items: [reservation], total: 1 })),
      releaseReservation: vi.fn(async () => ({
        ...reservation,
        reservationStatus: CapacityReservationStatus.RELEASED,
      })),
      updateRequest: vi.fn(async () => ({
        ...request,
        requestStatus: PlacementRequestStatus.CANCELLED,
      })),
      listDecisions: vi.fn(async () => ({
        items: [{ id: 'dec-1', decisionStatus: PDS.PLACED, version: 1 }],
        total: 1,
      })),
      updateDecision: vi.fn(async () => ({})),
      appendHistory: vi.fn(async () => ({})),
    };
    const outbox = outboxOk();
    const uc = new CancelPlacementUseCase(repo as never, outbox as never, auditOk() as never);
    await uc.execute({ actorId: 'a1', placementRequestId: 'pr-1', reason: 'ops' });
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.releaseReservation).toHaveBeenCalledWith('res-1', 'ops', 1, FAKE_CLIENT);
  });

  it('release reservation uses single runWithOutbox', async () => {
    const reservation = {
      id: 'res-1',
      version: 3,
      reservationStatus: CapacityReservationStatus.HELD,
    };
    const repo = {
      getReservation: vi.fn(async () => reservation),
      releaseReservation: vi.fn(async () => ({
        ...reservation,
        reservationStatus: CapacityReservationStatus.RELEASED,
        version: 4,
      })),
      appendHistory: vi.fn(async () => ({})),
    };
    const outbox = outboxOk();
    const uc = new ReleaseReservationUseCase(repo as never, outbox as never, auditOk() as never);
    await uc.execute({
      actorId: 'a1',
      reservationId: 'res-1',
      expectedVersion: 3,
      reason: 'manual',
    });
    expect(outbox.runWithOutbox).toHaveBeenCalledTimes(1);
    expect(repo.releaseReservation).toHaveBeenCalledWith('res-1', 'manual', 3, FAKE_CLIENT);
  });

  it('evaluate refuses cancelled requests before outbox', async () => {
    const repo = {
      getRequest: vi.fn(async () => ({
        id: 'pr-1',
        requestStatus: PlacementRequestStatus.CANCELLED,
      })),
    };
    const outbox = outboxOk();
    const uc = new EvaluatePlacementUseCase(
      repo as never,
      {} as never,
      outbox as never,
      auditOk() as never,
    );
    await expect(
      uc.execute({ actorId: 'a1', placementRequestId: 'pr-1' }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(outbox.runWithOutbox).not.toHaveBeenCalled();
  });
});
