import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import {
  assertEndpointAllowsDispatch,
  assertEndpointTransition,
} from '../../domain/product-control/endpoint-lifecycle.js';
import {
  assertDiscoveryNotExpired,
  assertProductIdMatches,
  evaluateContractCompatibility,
  parseDiscoveryDocument,
} from '../../domain/product-control/contract-validation.js';
import { assertExchangeTransition } from '../../domain/product-control/exchange-state-machine.js';
import {
  classifyProductControlError,
  isRetryableProductControlError,
} from '../../domain/product-control/error-classification.js';
import {
  createCapabilitiesDiscoveredEvent,
  createEndpointQuarantinedEvent,
  createEndpointRegisteredEvent,
  createEndpointStatusChangedEvent,
  createExchangeUnknownOutcomeEvent,
  createHandshakeCompletedEvent,
} from '../../domain/product-control/product-control.events.js';
import type { ProductControlClientPort } from '../../domain/product-control/product-control-client.port.js';
import type { ProductControlRepositoryPort } from '../../domain/product-control/product-control-repository.port.js';
import type { SignatureVerifierPort } from '../../domain/product-control/signature-verifier.port.js';
import {
  ControlCallbackStatus,
  ControlExchangeStatus,
  CredentialBindingStatus,
  ExchangeReconciliationStatus,
  HealthCheckResult,
  NegotiatedContractStatus,
  ProductControlEndpointStatus,
  ProductControlErrorCode,
  type ControlExchangeRecord,
  type ProductControlEndpointRecord,
} from '../../domain/product-control/product-control.types.js';

async function requireAudit(
  audit: AuditEventRepositoryPort,
  input: {
    eventType: string;
    actorId: string;
    subjectType: string;
    subjectId: string;
    details: Record<string, unknown>;
  },
  client: unknown,
): Promise<void> {
  try {
    await audit.create(input, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for product-control mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

function pcCodeFromError(err: unknown): ProductControlErrorCode {
  if (err instanceof DomainError) {
    const detail = err.details[0] as { code?: string } | undefined;
    if (detail?.code) return classifyProductControlError(detail.code);
  }
  return classifyProductControlError(err);
}

// ---------------------------------------------------------------------------
// Register / Validate / Quarantine
// ---------------------------------------------------------------------------

export class RegisterProductControlEndpointUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    productRegistryId: string;
    productId: string;
    platformId: string;
    environmentId?: string | null;
    code: string;
    baseUrl: string;
    contractVersion: string;
    authProfile: string;
    credentialRef: string;
    allowedScopes?: unknown[];
  }) {
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const endpoint = await this.repo.insertEndpoint(
        {
          productRegistryId: input.productRegistryId,
          productId: input.productId,
          platformId: input.platformId,
          environmentId: input.environmentId ?? null,
          deploymentProfileId: null,
          registryContractId: null,
          code: input.code,
          baseUrl: input.baseUrl,
          apiVersion: 'v1',
          contractVersion: input.contractVersion,
          authProfile: input.authProfile,
          credentialRef: input.credentialRef,
          allowedScopes: input.allowedScopes ?? [],
          status: ProductControlEndpointStatus.PENDING_VALIDATION,
          contractFingerprint: null,
          identityFingerprint: null,
          registrationSource: 'MANUAL',
          lastHandshakeAt: null,
          lastHandshakeStatus: null,
          lastHandshakeError: null,
          lastHealthCheckAt: null,
          lastHealthStatus: null,
          metadata: {},
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.upsertCredentialBinding(
        {
          endpointId: endpoint.id,
          credentialRef: input.credentialRef,
          authProfile: input.authProfile,
          status: CredentialBindingStatus.ACTIVE,
          expiresAt: null,
          revokedAt: null,
          revokedBy: null,
          metadata: {},
        },
        client,
      );
      await this.repo.insertHistory(
        {
          resourceType: 'ENDPOINT',
          resourceId: endpoint.id,
          fromStatus: null,
          toStatus: endpoint.status,
          action: 'REGISTER',
          reason: null,
          actorId: input.actorId,
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'product_control.endpoint.register',
          actorId: input.actorId,
          subjectType: 'PRODUCT_CONTROL_ENDPOINT',
          subjectId: endpoint.id,
          details: { code: endpoint.code },
        },
        client,
      );
      await enqueue(
        createEndpointRegisteredEvent({
          actorId: input.actorId,
          correlationId: input.correlationId,
          endpointId: endpoint.id,
          productId: endpoint.productId,
          code: endpoint.code,
        }),
      );
      return endpoint;
    });
  }
}

export class ValidateProductControlEndpointUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; correlationId: string; endpointId: string }) {
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const current = await this.repo.findEndpointByIdForUpdate(input.endpointId, client);
      if (!current) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Endpoint not found');
      }
      assertEndpointTransition(current.status, ProductControlEndpointStatus.VALIDATING);
      const updated = await this.repo.updateEndpointStatus(
        current.id,
        current.status,
        ProductControlEndpointStatus.VALIDATING,
        current.version,
        { updatedBy: input.actorId },
        client,
      );
      await this.repo.insertHistory(
        {
          resourceType: 'ENDPOINT',
          resourceId: updated.id,
          fromStatus: current.status,
          toStatus: updated.status,
          action: 'VALIDATE',
          reason: null,
          actorId: input.actorId,
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'product_control.endpoint.validate',
          actorId: input.actorId,
          subjectType: 'PRODUCT_CONTROL_ENDPOINT',
          subjectId: updated.id,
          details: {},
        },
        client,
      );
      await enqueue(
        createEndpointStatusChangedEvent({
          actorId: input.actorId,
          correlationId: input.correlationId,
          endpointId: updated.id,
          fromStatus: current.status,
          toStatus: updated.status,
        }),
      );
      return updated;
    });
  }
}

export class QuarantineProductControlEndpointUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    endpointId: string;
    reason: string;
  }) {
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const current = await this.repo.findEndpointByIdForUpdate(input.endpointId, client);
      if (!current) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Endpoint not found');
      }
      assertEndpointTransition(
        current.status,
        ProductControlEndpointStatus.QUARANTINED,
        input.reason,
      );
      const updated = await this.repo.updateEndpointStatus(
        current.id,
        current.status,
        ProductControlEndpointStatus.QUARANTINED,
        current.version,
        { updatedBy: input.actorId },
        client,
      );
      await this.repo.insertHistory(
        {
          resourceType: 'ENDPOINT',
          resourceId: updated.id,
          fromStatus: current.status,
          toStatus: updated.status,
          action: 'QUARANTINE',
          reason: input.reason,
          actorId: input.actorId,
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'product_control.endpoint.quarantine',
          actorId: input.actorId,
          subjectType: 'PRODUCT_CONTROL_ENDPOINT',
          subjectId: updated.id,
          details: { reason: input.reason },
        },
        client,
      );
      await enqueue(
        createEndpointQuarantinedEvent({
          actorId: input.actorId,
          correlationId: input.correlationId,
          endpointId: updated.id,
          reason: input.reason,
        }),
      );
      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Shared exchange dispatch helper
// ---------------------------------------------------------------------------

type DispatchPrepare =
  | { kind: 'idempotent'; exchange: ControlExchangeRecord; endpoint: ProductControlEndpointRecord }
  | {
      kind: 'dispatch';
      exchange: ControlExchangeRecord;
      endpoint: ProductControlEndpointRecord;
    };

async function prepareDispatch(params: {
  repo: ProductControlRepositoryPort;
  outbox: ControlPlaneOutboxTransactionService;
  audit: AuditEventRepositoryPort;
  actorId: string;
  correlationId: string;
  endpointId: string;
  operationCode: string;
  idempotencyKey: string;
  workflowId?: string | null;
  stepId?: string | null;
}): Promise<DispatchPrepare> {
  return params.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
    const endpoint = await params.repo.findEndpointByIdForUpdate(params.endpointId, client);
    if (!endpoint) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Endpoint not found');
    }
    assertEndpointAllowsDispatch(endpoint.status);

    const existing = await params.repo.findExchangeByIdempotencyKey(params.idempotencyKey, client);
    if (existing) {
      return { kind: 'idempotent' as const, exchange: existing, endpoint };
    }

    const requestId = randomUUID();
    const exchange = await params.repo.insertExchange(
      {
        productId: endpoint.productId,
        endpointId: endpoint.id,
        workflowId: params.workflowId ?? null,
        stepId: params.stepId ?? null,
        operationCode: params.operationCode,
        contractVersion: endpoint.contractVersion,
        requestId,
        correlationId: params.correlationId,
        causationId: null,
        idempotencyKey: params.idempotencyKey,
        requestDigest: null,
        responseDigest: null,
        requestTimestamp: new Date(),
        responseTimestamp: null,
        status: ControlExchangeStatus.SENDING,
        attemptCount: 1,
        httpStatus: null,
        errorClassification: null,
        durationMs: null,
        retryEligible: false,
        reconciliationStatus: ExchangeReconciliationStatus.NONE,
        requestPayload: { operationCode: params.operationCode },
        responsePayload: {},
        diagnostics: {},
      },
      client,
    );
    await params.repo.insertHistory(
      {
        resourceType: 'EXCHANGE',
        resourceId: exchange.id,
        fromStatus: null,
        toStatus: exchange.status,
        action: 'DISPATCH',
        reason: null,
        actorId: params.actorId,
        details: { operationCode: params.operationCode },
      },
      client,
    );
    await requireAudit(
      params.audit,
      {
        eventType: 'product_control.exchange.dispatch',
        actorId: params.actorId,
        subjectType: 'PRODUCT_CONTROL_EXCHANGE',
        subjectId: exchange.id,
        details: { operationCode: params.operationCode, endpointId: endpoint.id },
      },
      client,
    );
    void enqueue;
    return { kind: 'dispatch' as const, exchange, endpoint };
  });
}

async function finalizeExchange(params: {
  repo: ProductControlRepositoryPort;
  outbox: ControlPlaneOutboxTransactionService;
  audit: AuditEventRepositoryPort;
  actorId: string;
  correlationId: string;
  exchange: ControlExchangeRecord;
  endpoint: ProductControlEndpointRecord;
  success: boolean;
  httpStatus: number | null;
  errorClassification: string | null;
  durationMs: number | null;
  responseDigest: string | null;
  responsePayload: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
  endpointPatch?: Partial<
    Pick<
      ProductControlEndpointRecord,
      | 'contractFingerprint'
      | 'identityFingerprint'
      | 'lastHandshakeAt'
      | 'lastHandshakeStatus'
      | 'lastHandshakeError'
      | 'lastHealthCheckAt'
      | 'lastHealthStatus'
      | 'status'
    >
  >;
  activateEndpoint?: boolean;
  onSuccess?: (
    client: unknown,
    enqueue: (event: IntegrationEvent) => Promise<string>,
  ) => Promise<void>;
}): Promise<ControlExchangeRecord> {
  return params.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
    const locked = await params.repo.findEndpointByIdForUpdate(params.endpoint.id, client);
    if (!locked) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Endpoint not found');
    }
    // Quarantine during in-flight dispatch must still allow finalization of durable exchange,
    // but must not activate the endpoint.
    const quarantined =
      locked.status === ProductControlEndpointStatus.QUARANTINED ||
      locked.status === ProductControlEndpointStatus.REVOKED;

    const current = await params.repo.findExchangeById(params.exchange.id, client);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Exchange not found');
    }

    const toStatus = params.success
      ? ControlExchangeStatus.SUCCEEDED
      : ControlExchangeStatus.FAILED;
    assertExchangeTransition(current.status, toStatus);

    const updated = await params.repo.updateExchangeStatus(
      current.id,
      current.status,
      toStatus,
      current.version,
      {
        httpStatus: params.httpStatus,
        errorClassification: params.errorClassification,
        durationMs: params.durationMs,
        retryEligible: params.errorClassification
          ? isRetryableProductControlError(params.errorClassification)
          : false,
        responseDigest: params.responseDigest,
        responseTimestamp: new Date(),
        responsePayload: params.responsePayload,
        diagnostics: params.diagnostics ?? {},
      },
      client,
    );

    await params.repo.insertExchangeAttempt(
      {
        exchangeId: updated.id,
        attemptNumber: updated.attemptCount,
        outcome: params.success ? 'SUCCEEDED' : 'FAILED',
        httpStatus: params.httpStatus,
        errorClassification: params.errorClassification,
        durationMs: params.durationMs,
        responseDigest: params.responseDigest,
        completedAt: new Date(),
      },
      client,
    );

    if (params.activateEndpoint && params.success && !quarantined) {
      const target =
        locked.status === ProductControlEndpointStatus.VALIDATING ||
        locked.status === ProductControlEndpointStatus.PENDING_VALIDATION
          ? ProductControlEndpointStatus.ACTIVE
          : locked.status;
      if (target !== locked.status) {
        assertEndpointTransition(locked.status, target);
        await params.repo.updateEndpointStatus(
          locked.id,
          locked.status,
          target,
          locked.version,
          {
            updatedBy: params.actorId,
            ...params.endpointPatch,
          },
          client,
        );
        await params.repo.insertHistory(
          {
            resourceType: 'ENDPOINT',
            resourceId: locked.id,
            fromStatus: locked.status,
            toStatus: target,
            action: 'ACTIVATE_AFTER_HANDSHAKE',
            reason: null,
            actorId: params.actorId,
          },
          client,
        );
      } else if (params.endpointPatch) {
        await params.repo.updateEndpointStatus(
          locked.id,
          locked.status,
          locked.status,
          locked.version,
          { updatedBy: params.actorId, ...params.endpointPatch },
          client,
        );
      }
    } else if (params.endpointPatch && !quarantined) {
      await params.repo.updateEndpointStatus(
        locked.id,
        locked.status,
        locked.status,
        locked.version,
        { updatedBy: params.actorId, ...params.endpointPatch },
        client,
      );
    }

    await params.repo.insertHistory(
      {
        resourceType: 'EXCHANGE',
        resourceId: updated.id,
        fromStatus: current.status,
        toStatus: updated.status,
        action: 'FINALIZE',
        reason: params.errorClassification,
        actorId: params.actorId,
      },
      client,
    );
    await requireAudit(
      params.audit,
      {
        eventType: 'product_control.exchange.finalize',
        actorId: params.actorId,
        subjectType: 'PRODUCT_CONTROL_EXCHANGE',
        subjectId: updated.id,
        details: {
          success: params.success,
          errorClassification: params.errorClassification,
        },
      },
      client,
    );

    if (params.onSuccess && params.success) {
      await params.onSuccess(client, enqueue);
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Handshake / Discover / Health
// ---------------------------------------------------------------------------

export class HandshakeProductControlEndpointUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly client: ProductControlClientPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    endpointId: string;
    idempotencyKey?: string;
  }) {
    const idempotencyKey =
      input.idempotencyKey?.trim() || `handshake:${input.endpointId}:${input.correlationId}`;
    const prepared = await prepareDispatch({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      endpointId: input.endpointId,
      operationCode: 'handshake',
      idempotencyKey,
    });
    if (prepared.kind === 'idempotent') return prepared.exchange;

    let httpStatus: number | null = null;
    let responsePayload: Record<string, unknown> = {};
    let responseDigest: string | null = null;
    let durationMs: number | null = null;
    let errorClassification: string | null = null;
    let success = false;
    let discoveryFingerprint: string | null = null;
    let identityFingerprint: string | null = null;

    try {
      const res = await this.client.handshake({
        endpointId: prepared.endpoint.id,
        baseUrl: prepared.endpoint.baseUrl,
        apiVersion: prepared.endpoint.apiVersion,
        contractVersion: prepared.endpoint.contractVersion,
        credentialRef: prepared.endpoint.credentialRef,
        authProfile: String(prepared.endpoint.authProfile),
        operationCode: 'handshake',
        requestId: prepared.exchange.requestId,
        correlationId: input.correlationId,
        idempotencyKey,
      });
      httpStatus = res.httpStatus;
      responsePayload = res.body;
      responseDigest = res.responseDigest ?? null;
      durationMs = res.durationMs;
      if (res.httpStatus >= 200 && res.httpStatus < 300 && res.discovery) {
        assertDiscoveryNotExpired(res.discovery);
        assertProductIdMatches(prepared.endpoint.productId, res.discovery);
        discoveryFingerprint = res.discovery.contractFingerprint;
        identityFingerprint = res.discovery.productControlId;
        success = true;
      } else {
        errorClassification = ProductControlErrorCode.INVALID_RESPONSE;
      }
    } catch (err) {
      errorClassification = pcCodeFromError(err);
    }

    return finalizeExchange({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      exchange: prepared.exchange,
      endpoint: prepared.endpoint,
      success,
      httpStatus,
      errorClassification,
      durationMs,
      responseDigest,
      responsePayload,
      activateEndpoint: true,
      endpointPatch: success
        ? {
            contractFingerprint: discoveryFingerprint,
            identityFingerprint,
            lastHandshakeAt: new Date(),
            lastHandshakeStatus: 'SUCCEEDED',
            lastHandshakeError: null,
          }
        : {
            lastHandshakeAt: new Date(),
            lastHandshakeStatus: 'FAILED',
            lastHandshakeError: errorClassification,
          },
      onSuccess: async (_client, enqueue) => {
        await enqueue(
          createHandshakeCompletedEvent({
            actorId: input.actorId,
            correlationId: input.correlationId,
            endpointId: prepared.endpoint.id,
            exchangeId: prepared.exchange.id,
            success: true,
          }),
        );
      },
    });
  }
}

export class DiscoverProductControlContractUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly client: ProductControlClientPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    endpointId: string;
    idempotencyKey?: string;
  }) {
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `discover_contract:${input.endpointId}:${input.correlationId}`;
    const prepared = await prepareDispatch({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      endpointId: input.endpointId,
      operationCode: 'discover_contract',
      idempotencyKey,
    });
    if (prepared.kind === 'idempotent') return prepared.exchange;

    let httpStatus: number | null = null;
    let responsePayload: Record<string, unknown> = {};
    let responseDigest: string | null = null;
    let durationMs: number | null = null;
    let errorClassification: string | null = null;
    let success = false;
    let document: ReturnType<typeof parseDiscoveryDocument> | null = null;

    try {
      const res = await this.client.discoverContract({
        endpointId: prepared.endpoint.id,
        baseUrl: prepared.endpoint.baseUrl,
        apiVersion: prepared.endpoint.apiVersion,
        contractVersion: prepared.endpoint.contractVersion,
        credentialRef: prepared.endpoint.credentialRef,
        authProfile: String(prepared.endpoint.authProfile),
        operationCode: 'discover_contract',
        requestId: prepared.exchange.requestId,
        correlationId: input.correlationId,
        idempotencyKey,
      });
      httpStatus = res.httpStatus;
      responsePayload = res.body;
      responseDigest = res.responseDigest ?? null;
      durationMs = res.durationMs;
      document = parseDiscoveryDocument(res.discovery ?? res.body);
      if (document.ok) {
        assertDiscoveryNotExpired(document.document);
        assertProductIdMatches(prepared.endpoint.productId, document.document);
        const compat = evaluateContractCompatibility({
          requiredContractVersion: prepared.endpoint.contractVersion,
          supportedContractVersions: document.document.supportedContractVersions,
        });
        if (!compat.compatible) {
          errorClassification = compat.code;
        } else {
          success = true;
        }
      } else {
        errorClassification = document.code;
      }
    } catch (err) {
      errorClassification = pcCodeFromError(err);
    }

    return finalizeExchange({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      exchange: prepared.exchange,
      endpoint: prepared.endpoint,
      success,
      httpStatus,
      errorClassification,
      durationMs,
      responseDigest,
      responsePayload,
      endpointPatch: success && document && document.ok
        ? { contractFingerprint: document.document.contractFingerprint }
        : undefined,
      onSuccess: async (client) => {
        if (!document || !document.ok) return;
        await this.repo.insertNegotiatedContract(
          {
            endpointId: prepared.endpoint.id,
            contractVersion: prepared.endpoint.contractVersion,
            fingerprint: document.document.contractFingerprint,
            schemaSnapshot: document.document as unknown as Record<string, unknown>,
            supportedVersions: document.document.supportedContractVersions,
            status: NegotiatedContractStatus.COMPATIBLE,
            discoveredAt: new Date(),
            validatedAt: new Date(),
            metadata: {},
          },
          client,
        );
      },
    });
  }
}

export class DiscoverProductControlCapabilitiesUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly client: ProductControlClientPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    endpointId: string;
    idempotencyKey?: string;
  }) {
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `discover_capabilities:${input.endpointId}:${input.correlationId}`;
    const prepared = await prepareDispatch({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      endpointId: input.endpointId,
      operationCode: 'discover_capabilities',
      idempotencyKey,
    });
    if (prepared.kind === 'idempotent') return prepared.exchange;

    let httpStatus: number | null = null;
    let responsePayload: Record<string, unknown> = {};
    let responseDigest: string | null = null;
    let durationMs: number | null = null;
    let errorClassification: string | null = null;
    let success = false;
    let capabilityCodes: string[] = [];

    try {
      const res = await this.client.discoverCapabilities({
        endpointId: prepared.endpoint.id,
        baseUrl: prepared.endpoint.baseUrl,
        apiVersion: prepared.endpoint.apiVersion,
        contractVersion: prepared.endpoint.contractVersion,
        credentialRef: prepared.endpoint.credentialRef,
        authProfile: String(prepared.endpoint.authProfile),
        operationCode: 'discover_capabilities',
        requestId: prepared.exchange.requestId,
        correlationId: input.correlationId,
        idempotencyKey,
      });
      httpStatus = res.httpStatus;
      responsePayload = res.body;
      responseDigest = res.responseDigest ?? null;
      durationMs = res.durationMs;
      const doc = parseDiscoveryDocument(res.discovery ?? res.body);
      if (doc.ok) {
        assertProductIdMatches(prepared.endpoint.productId, doc.document);
        capabilityCodes = doc.document.supportedCapabilities;
        success = true;
      } else if (Array.isArray(res.body.supportedCapabilities)) {
        capabilityCodes = res.body.supportedCapabilities.filter(
          (c): c is string => typeof c === 'string',
        );
        success = true;
      } else {
        errorClassification = ProductControlErrorCode.INVALID_RESPONSE;
      }
    } catch (err) {
      errorClassification = pcCodeFromError(err);
    }

    return finalizeExchange({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      exchange: prepared.exchange,
      endpoint: prepared.endpoint,
      success,
      httpStatus,
      errorClassification,
      durationMs,
      responseDigest,
      responsePayload,
      onSuccess: async (client, enqueue) => {
        await this.repo.replaceCapabilities(
          prepared.endpoint.id,
          capabilityCodes.map((capabilityCode) => ({ capabilityCode })),
          client,
        );
        await enqueue(
          createCapabilitiesDiscoveredEvent({
            actorId: input.actorId,
            correlationId: input.correlationId,
            endpointId: prepared.endpoint.id,
            capabilityCodes,
          }),
        );
      },
    });
  }
}

export class HealthCheckProductControlEndpointUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly client: ProductControlClientPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    endpointId: string;
    idempotencyKey?: string;
  }) {
    const idempotencyKey =
      input.idempotencyKey?.trim() || `health:${input.endpointId}:${input.correlationId}`;
    const prepared = await prepareDispatch({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      endpointId: input.endpointId,
      operationCode: 'verify_health',
      idempotencyKey,
    });
    if (prepared.kind === 'idempotent') return prepared.exchange;

    let httpStatus: number | null = null;
    let responsePayload: Record<string, unknown> = {};
    let responseDigest: string | null = null;
    let durationMs: number | null = null;
    let errorClassification: string | null = null;
    let success = false;
    let healthResult: HealthCheckResult = HealthCheckResult.UNKNOWN;

    try {
      const res = await this.client.verifyHealth({
        endpointId: prepared.endpoint.id,
        baseUrl: prepared.endpoint.baseUrl,
        apiVersion: prepared.endpoint.apiVersion,
        contractVersion: prepared.endpoint.contractVersion,
        credentialRef: prepared.endpoint.credentialRef,
        authProfile: String(prepared.endpoint.authProfile),
        operationCode: 'verify_health',
        requestId: prepared.exchange.requestId,
        correlationId: input.correlationId,
        idempotencyKey,
      });
      httpStatus = res.httpStatus;
      responsePayload = res.body;
      responseDigest = res.responseDigest ?? null;
      durationMs = res.durationMs;
      const statusRaw =
        (typeof res.body.healthStatus === 'string' && res.body.healthStatus) ||
        res.discovery?.healthStatus ||
        (res.httpStatus >= 200 && res.httpStatus < 300 ? 'HEALTHY' : 'UNAVAILABLE');
      if (statusRaw === 'HEALTHY') {
        healthResult = HealthCheckResult.HEALTHY;
        success = true;
      } else if (statusRaw === 'DEGRADED') {
        healthResult = HealthCheckResult.DEGRADED;
        success = true;
      } else {
        healthResult = HealthCheckResult.UNAVAILABLE;
        errorClassification = ProductControlErrorCode.ENDPOINT_UNAVAILABLE;
      }
    } catch (err) {
      errorClassification = pcCodeFromError(err);
      healthResult = HealthCheckResult.UNAVAILABLE;
    }

    return finalizeExchange({
      repo: this.repo,
      outbox: this.outbox,
      audit: this.audit,
      actorId: input.actorId,
      correlationId: input.correlationId,
      exchange: prepared.exchange,
      endpoint: prepared.endpoint,
      success,
      httpStatus,
      errorClassification,
      durationMs,
      responseDigest,
      responsePayload,
      endpointPatch: {
        lastHealthCheckAt: new Date(),
        lastHealthStatus: healthResult,
      },
      onSuccess: async (client) => {
        await this.repo.insertHealthCheck(
          {
            endpointId: prepared.endpoint.id,
            result: healthResult,
            latencyMs: durationMs,
            httpStatus,
            errorClassification,
            details: responsePayload,
          },
          client,
        );
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Reconcile / Callback / Lists
// ---------------------------------------------------------------------------

export class ReconcileProductControlExchangeUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    exchangeId: string;
    outcome: 'SUCCEEDED' | 'FAILED';
    notes?: string;
  }) {
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const exchange = await this.repo.findExchangeById(input.exchangeId, client);
      if (!exchange) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Exchange not found');
      }
      if (
        exchange.status !== ControlExchangeStatus.UNKNOWN_OUTCOME &&
        exchange.status !== ControlExchangeStatus.RECONCILIATION_REQUIRED
      ) {
        throw new DomainError(
          ErrorCode.INVALID_STATE_TRANSITION,
          `Exchange ${exchange.status} is not eligible for reconciliation`,
        );
      }

      const endpoint = await this.repo.findEndpointByIdForUpdate(exchange.endpointId, client);
      if (!endpoint) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Endpoint not found');
      }

      let recon = await this.repo.findOpenReconciliationByExchangeId(exchange.id, client);
      if (!recon) {
        recon = await this.repo.insertReconciliation(
          {
            exchangeId: exchange.id,
            endpointId: endpoint.id,
            reason: 'UNKNOWN_OUTCOME',
            status: 'IN_PROGRESS',
            resolvedAt: null,
            resolvedBy: null,
            resolutionNotes: null,
            details: {},
          },
          client,
        );
      }

      const toStatus =
        input.outcome === 'SUCCEEDED'
          ? ControlExchangeStatus.SUCCEEDED
          : ControlExchangeStatus.FAILED;
      assertExchangeTransition(exchange.status, toStatus);
      const updated = await this.repo.updateExchangeStatus(
        exchange.id,
        exchange.status,
        toStatus,
        exchange.version,
        {
          reconciliationStatus: ExchangeReconciliationStatus.RECONCILED,
          errorClassification:
            input.outcome === 'FAILED' ? ProductControlErrorCode.UNKNOWN_OUTCOME : null,
          diagnostics: {
            ...exchange.diagnostics,
            reconciledOutcome: toStatus,
            notes: input.notes ?? null,
          },
        },
        client,
      );

      await this.repo.updateReconciliation(
        recon.id,
        {
          status: input.outcome === 'SUCCEEDED' ? 'RESOLVED_SUCCESS' : 'RESOLVED_FAILURE',
          resolvedAt: new Date(),
          resolvedBy: input.actorId,
          resolutionNotes: input.notes ?? null,
        },
        client,
      );

      await this.repo.insertHistory(
        {
          resourceType: 'RECONCILIATION',
          resourceId: recon.id,
          fromStatus: exchange.status,
          toStatus: updated.status,
          action: 'RECONCILE',
          reason: input.notes ?? null,
          actorId: input.actorId,
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'product_control.exchange.reconcile',
          actorId: input.actorId,
          subjectType: 'PRODUCT_CONTROL_EXCHANGE',
          subjectId: updated.id,
          details: { outcome: input.outcome },
        },
        client,
      );
      void enqueue;
      return updated;
    });
  }
}

export class ReceiveProductControlCallbackUseCase {
  constructor(
    private readonly repo: ProductControlRepositoryPort,
    private readonly signatures: SignatureVerifierPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    endpointId: string;
    callbackId: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    signature?: string;
    signatureAlg?: string;
    issuedAt?: string;
    requestId?: string | null;
    exchangeId?: string | null;
  }) {
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const existing = await this.repo.findCallbackByIdempotencyKey(input.idempotencyKey, client);
      if (existing) {
        return { ...existing, duplicate: true as const };
      }

      const endpoint = await this.repo.findEndpointByIdForUpdate(input.endpointId, client);
      if (!endpoint) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Endpoint not found');
      }

      let signatureValid: boolean | null = null;
      let status = ControlCallbackStatus.RECEIVED;
      let rejectionReason: string | null = null;

      if (input.signature) {
        const verified = await this.signatures.verify({
          algorithm: input.signatureAlg ?? 'HS256',
          payload: JSON.stringify(input.payload),
          signature: input.signature,
          keyMaterialRef: endpoint.credentialRef,
          issuedAt: input.issuedAt,
        });
        signatureValid = verified.valid;
        if (!verified.valid) {
          status = ControlCallbackStatus.REJECTED;
          rejectionReason = verified.reason;
        } else {
          status = ControlCallbackStatus.VALIDATED;
        }
      }

      const callback = await this.repo.insertCallback(
        {
          endpointId: endpoint.id,
          exchangeId: input.exchangeId ?? null,
          callbackId: input.callbackId,
          correlationId: input.correlationId,
          requestId: input.requestId ?? null,
          signatureValid,
          payload: input.payload,
          status,
          rejectionReason,
          idempotencyKey: input.idempotencyKey,
        },
        client,
      );

      await this.repo.insertHistory(
        {
          resourceType: 'CALLBACK',
          resourceId: callback.id,
          fromStatus: null,
          toStatus: callback.status,
          action: 'RECEIVE',
          reason: rejectionReason,
          actorId: input.actorId,
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'product_control.callback.receive',
          actorId: input.actorId,
          subjectType: 'PRODUCT_CONTROL_CALLBACK',
          subjectId: callback.id,
          details: { status: callback.status, signatureValid },
        },
        client,
      );

      if (
        status === ControlCallbackStatus.VALIDATED &&
        typeof input.payload.unknownOutcome === 'boolean' &&
        input.payload.unknownOutcome &&
        input.exchangeId
      ) {
        await enqueue(
          createExchangeUnknownOutcomeEvent({
            actorId: input.actorId,
            correlationId: input.correlationId,
            exchangeId: input.exchangeId,
            endpointId: endpoint.id,
          }),
        );
      }

      return { ...callback, duplicate: false as const };
    });
  }
}

export class ListProductControlResourcesUseCase {
  constructor(private readonly repo: ProductControlRepositoryPort) {}

  listEndpoints(filter: {
    productId?: string;
    platformId?: string;
    status?: ProductControlEndpointStatus;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listEndpoints(filter);
  }

  getEndpoint(id: string) {
    return this.repo.findEndpointById(id);
  }

  listExchanges(filter: {
    endpointId?: string;
    status?: ControlExchangeStatus;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listExchanges(filter);
  }

  getExchange(id: string) {
    return this.repo.findExchangeById(id);
  }

  listCapabilities(endpointId: string) {
    return this.repo.listCapabilities(endpointId);
  }
}
