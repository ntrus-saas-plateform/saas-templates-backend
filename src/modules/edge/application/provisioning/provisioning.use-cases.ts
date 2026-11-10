import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import {
  assertAccountProductIntegrity,
  assertEnvironmentSlotRules,
  assertNotTechnicalActiveLabel,
  evaluateConditionalTenantReuse,
} from '../../domain/provisioning/provisioning-request.entity.js';
import type { ProvisioningRepositoryPort } from '../../domain/provisioning/provisioning-repository.port.js';
import type { P5AuthorizationStatusPort } from '../../domain/provisioning/p5-authorization-status.port.js';
import {
  parseEnvironmentSlot,
  verifyAuthorizationIntegrity,
  type PublicKeyMaterial,
} from '../../domain/provisioning/authorization-verification.js';
import {
  AuthorizationVerificationStatus,
  type CanonicalProvisioningAuthorization,
  ProvisioningRequestStatus,
  RevocationStatus,
} from '../../domain/provisioning/provisioning.types.js';
import {
  createAuthorizationRejectedEvent,
  createAuthorizationRevokedEvent,
  createAuthorizationVerifiedEvent,
  createProvisioningRequestAcceptedEvent,
  createProvisioningRequestCancelledEvent,
  createProvisioningRequestReceivedEvent,
  createProvisioningRequestRejectedEvent,
  EDGE_P7_OUTBOX_TENANT,
  LEGACY_PROVISIONING_REQUESTED_EVENT,
} from '../../domain/provisioning/provisioning.events.js';

async function enqueueP7(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  event: IntegrationEvent<unknown>,
): Promise<void> {
  if (!outbox) return;
  await outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (_client, enqueue) => {
    await enqueue(event);
  });
}

export type TrustMaterialProvider = () => {
  keys: PublicKeyMaterial[];
  allowedIssuers: string[];
};

export class AcceptProvisioningAuthorizationUseCase {
  constructor(
    private readonly repo: ProvisioningRepositoryPort,
    private readonly p5Status: P5AuthorizationStatusPort,
    private readonly trust: TrustMaterialProvider,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly audit?: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    authorization: CanonicalProvisioningAuthorization;
    source?: string;
    expectedAccountId?: string;
    expectedProductId?: string;
    expectedSubscriptionId?: string;
    reuse?: {
      lifecycleCompatible?: boolean;
      legalHold?: boolean;
      securityHold?: boolean;
      explicitReuseApproved?: boolean;
    };
  }) {
    const auth = input.authorization;
    const existing = await this.repo.findRequestByAuthOpVersion(
      auth.authorization_id,
      auth.operation,
      auth.authorization_version,
    );
    if (existing) {
      return { outcome: 'IDEMPOTENT_REPLAY' as const, request: existing };
    }
    const byKey = await this.repo.findRequestByIdempotencyKey(auth.idempotency_key);
    if (byKey) {
      return { outcome: 'IDEMPOTENT_REPLAY' as const, request: byKey };
    }

    let slot;
    try {
      slot = parseEnvironmentSlot(auth.environment_slot);
    } catch {
      return this.rejectEarly(input, auth, 'UNSUPPORTED_ENVIRONMENT_SLOT');
    }

    try {
      assertEnvironmentSlotRules({
        slot,
        slotEntitled:
          slot.toString() === 'PROD' ? true : auth.extra_prod_slot_entitled === true,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        return this.rejectEarly(input, auth, 'SLOT_ENTITLEMENT_REQUIRED');
      }
      throw err;
    }

    if (input.expectedAccountId || input.expectedProductId || input.expectedSubscriptionId) {
      try {
        assertAccountProductIntegrity({
          authAccountId: auth.account_id,
          authProductId: auth.product_id,
          authSubscriptionId: auth.subscription_id,
          requestAccountId: input.expectedAccountId ?? auth.account_id,
          requestProductId: input.expectedProductId ?? auth.product_id,
          requestSubscriptionId: input.expectedSubscriptionId ?? auth.subscription_id,
        });
      } catch (err) {
        if (err instanceof DomainError) {
          return this.rejectEarly(input, auth, String(err.details?.[0]?.['field'] ?? 'MISMATCH'));
        }
        throw err;
      }
    }

    const trust = this.trust();
    const integrity = verifyAuthorizationIntegrity({
      authorization: auth,
      keys: trust.keys,
      allowedIssuers: trust.allowedIssuers,
    });

    const stored = await this.repo.upsertAuthorization({
      auth,
      environmentSlot: slot,
      verificationStatus: integrity.status,
      verificationReasonCode: integrity.reasonCode,
      verifiedAt: integrity.ok ? new Date() : null,
      signaturePresent: Boolean(auth.signature),
    });

    if (!integrity.ok) {
      await enqueueP7(
        this.outbox,
        createAuthorizationRejectedEvent({
          actorId: input.actorId,
          correlationId: auth.correlation_id,
          authorizationId: auth.authorization_id,
          reasonCode: integrity.reasonCode ?? 'INTEGRITY_FAILED',
        }),
      );
      await this.auditSafe(input.actorId, 'provisioning.authorization.verification_failed', {
        authorizationId: auth.authorization_id,
        reasonCode: integrity.reasonCode,
      });
      return this.createRejectedRequest(input, auth, stored.id, slot, integrity.reasonCode ?? 'INTEGRITY_FAILED');
    }

    // OQ-04: synchronous P5 status verification, fail-closed
    const status = await this.p5Status.verifyCurrentStatus({
      authorizationId: auth.authorization_id,
      authorizationVersion: auth.authorization_version,
      correlationId: auth.correlation_id,
    });
    if (status.outcome === 'UNAVAILABLE' || status.outcome === 'UNKNOWN') {
      await this.auditSafe(input.actorId, 'provisioning.authorization.p5_unavailable', {
        authorizationId: auth.authorization_id,
        outcome: status.outcome,
      });
      return this.createRejectedRequest(
        input,
        auth,
        stored.id,
        slot,
        status.outcome === 'UNAVAILABLE' ? 'P5_UNAVAILABLE' : 'P5_STATUS_UNCERTAIN',
      );
    }
    if (status.outcome === 'REVOKED' || status.outcome === 'EXPIRED' || status.outcome === 'DENY') {
      return this.createRejectedRequest(
        input,
        auth,
        stored.id,
        slot,
        `P5_STATUS_${status.outcome}`,
      );
    }

    const reuse = evaluateConditionalTenantReuse({
      proposedProductTenantId: auth.product_tenant_id,
      sameAccount: true,
      sameProduct: true,
      lifecycleCompatible: input.reuse?.lifecycleCompatible ?? false,
      legalHold: input.reuse?.legalHold ?? false,
      securityHold: input.reuse?.securityHold ?? false,
      explicitReuseApproved: input.reuse?.explicitReuseApproved ?? false,
    });
    const productTenantId =
      reuse.reuse && auth.product_tenant_id ? auth.product_tenant_id : null;

    const requestNumber = `PR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8)}`;
    try {
      const request = await this.repo.createRequest({
        requestNumber,
        authorizationId: auth.authorization_id,
        authorizationVersion: auth.authorization_version,
        authorizationRowId: stored.id,
        operation: auth.operation,
        accountId: auth.account_id,
        productId: auth.product_id,
        subscriptionId: auth.subscription_id,
        productTenantId,
        correlationId: auth.correlation_id,
        causationId: auth.causation_id ?? null,
        requestStatus: ProvisioningRequestStatus.ACCEPTED,
        environmentSlot: slot,
        idempotencyKey: auth.idempotency_key,
        deduplicationReference: `${auth.authorization_id}:${auth.operation}:${auth.authorization_version}`,
        payloadDigest: auth.payload_digest,
        entitlementSnapshotReference: auth.entitlement_snapshot_reference,
        policyVersion: auth.commercial_policy_version ?? null,
        rejectionReasonCode: null,
        source: input.source ?? 'P5_COORDINATION',
        createdBy: input.actorId,
        lastActor: input.actorId,
        metadata: {
          reuseDecision: reuse,
          note: 'ACCEPTED means durable request recorded — not tenant ACTIVE',
        },
        acceptedAt: new Date(),
      });
      assertNotTechnicalActiveLabel(request.requestStatus);

      await enqueueP7(
        this.outbox,
        createAuthorizationVerifiedEvent({
          actorId: input.actorId,
          correlationId: auth.correlation_id,
          authorizationId: auth.authorization_id,
          authorizationVersion: auth.authorization_version,
          requestId: request.id,
        }),
      );
      await enqueueP7(
        this.outbox,
        createProvisioningRequestReceivedEvent({
          actorId: input.actorId,
          correlationId: auth.correlation_id,
          requestId: request.id,
          authorizationId: auth.authorization_id,
        }),
      );
      await enqueueP7(
        this.outbox,
        createProvisioningRequestAcceptedEvent({
          actorId: input.actorId,
          correlationId: auth.correlation_id,
          requestId: request.id,
        }),
      );
      await this.auditSafe(input.actorId, 'provisioning.request.accepted', {
        requestId: request.id,
        authorizationId: auth.authorization_id,
      });
      return { outcome: 'ACCEPTED' as const, request };
    } catch (err) {
      if (err instanceof DomainError && err.code === ErrorCode.IDEMPOTENCY_CONFLICT) {
        const replay =
          (await this.repo.findRequestByAuthOpVersion(
            auth.authorization_id,
            auth.operation,
            auth.authorization_version,
          )) ?? (await this.repo.findRequestByIdempotencyKey(auth.idempotency_key));
        if (replay) return { outcome: 'IDEMPOTENT_REPLAY' as const, request: replay };
      }
      throw err;
    }
  }

  private async rejectEarly(
    input: { actorId: string; source?: string },
    auth: CanonicalProvisioningAuthorization,
    reasonCode: string,
  ) {
    const stored = await this.repo.upsertAuthorization({
      auth,
      environmentSlot: auth.environment_slot ?? 'PROD',
      verificationStatus: AuthorizationVerificationStatus.REJECTED,
      verificationReasonCode: reasonCode,
      verifiedAt: null,
      signaturePresent: Boolean(auth.signature),
    });
    return this.createRejectedRequest(input, auth, stored.id, auth.environment_slot ?? 'PROD', reasonCode);
  }

  private async createRejectedRequest(
    input: { actorId: string; source?: string },
    auth: CanonicalProvisioningAuthorization,
    authorizationRowId: string,
    slot: string,
    reasonCode: string,
  ) {
    try {
      const request = await this.repo.createRequest({
        requestNumber: `PR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8)}`,
        authorizationId: auth.authorization_id,
        authorizationVersion: auth.authorization_version,
        authorizationRowId,
        operation: auth.operation,
        accountId: auth.account_id,
        productId: auth.product_id,
        subscriptionId: auth.subscription_id,
        productTenantId: null,
        correlationId: auth.correlation_id,
        causationId: auth.causation_id ?? null,
        requestStatus: ProvisioningRequestStatus.REJECTED,
        environmentSlot: slot,
        idempotencyKey: auth.idempotency_key,
        deduplicationReference: `${auth.authorization_id}:${auth.operation}:${auth.authorization_version}`,
        payloadDigest: auth.payload_digest,
        entitlementSnapshotReference: auth.entitlement_snapshot_reference,
        policyVersion: auth.commercial_policy_version ?? null,
        rejectionReasonCode: reasonCode,
        source: input.source ?? 'P5_COORDINATION',
        createdBy: input.actorId,
        lastActor: input.actorId,
        metadata: { rejected: true },
        rejectedAt: new Date(),
      });
      await enqueueP7(
        this.outbox,
        createProvisioningRequestRejectedEvent({
          actorId: input.actorId,
          correlationId: auth.correlation_id,
          requestId: request.id,
          reasonCode,
        }),
      );
      return { outcome: 'REJECTED' as const, request, reasonCode };
    } catch (err) {
      if (err instanceof DomainError && err.code === ErrorCode.IDEMPOTENCY_CONFLICT) {
        const replay = await this.repo.findRequestByAuthOpVersion(
          auth.authorization_id,
          auth.operation,
          auth.authorization_version,
        );
        if (replay) return { outcome: 'IDEMPOTENT_REPLAY' as const, request: replay };
      }
      throw err;
    }
  }

  private async auditSafe(actorId: string, action: string, details: Record<string, unknown>) {
    if (!this.audit) return;
    try {
      await this.audit.create({
        eventType: action,
        actorId,
        subjectType: 'PROVISIONING',
        subjectId: String(details.requestId ?? details.authorizationId ?? ''),
        details,
      });
    } catch {
      /* audit must not break accept path */
    }
  }
}

export class CancelProvisioningRequestUseCase {
  constructor(
    private readonly repo: ProvisioningRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly audit?: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    requestId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Cancellation reason is required');
    }
    const request = await this.repo.getRequestById(input.requestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Provisioning request not found');
    }
    if (
      request.requestStatus !== ProvisioningRequestStatus.REQUESTED &&
      request.requestStatus !== ProvisioningRequestStatus.ACCEPTED
    ) {
      throw new DomainError(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Request in status ${request.requestStatus} cannot be cancelled`,
      );
    }
    const updated = await this.repo.transitionRequest({
      id: request.id,
      fromStatus: request.requestStatus,
      toStatus: ProvisioningRequestStatus.CANCELLED,
      actorType: 'OPERATOR',
      actorId: input.actorId,
      source: 'OPERATOR_API',
      reasonCode: 'OPERATOR_CANCEL',
      correlationId: request.correlationId,
      causationId: null,
      cancellationReason: input.reason.trim(),
      metadata: {
        note: 'P7 cancel does not revoke P5 authorization and does not destroy resources',
      },
    });
    await enqueueP7(
      this.outbox,
      createProvisioningRequestCancelledEvent({
        actorId: input.actorId,
        correlationId: request.correlationId,
        requestId: request.id,
        reason: input.reason.trim(),
      }),
    );
    if (this.audit) {
      await this.audit.create({
        eventType: 'provisioning.request.cancelled',
        actorId: input.actorId,
        subjectType: 'PROVISIONING_REQUEST',
        subjectId: request.id,
        details: { reason: input.reason.trim() },
      });
    }
    return updated;
  }
}

export class HandleAuthorizationRevocationUseCase {
  constructor(
    private readonly repo: ProvisioningRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly audit?: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    eventId: string;
    eventName: string;
    authorizationId: string;
    revocationVersion: number;
    revokedAt?: string | null;
    reasonCode?: string | null;
    reference?: string | null;
    payload?: Record<string, unknown>;
  }) {
    const inbox = await this.repo.recordRevocationInbox({
      eventId: input.eventId,
      authorizationId: input.authorizationId,
      revocationVersion: input.revocationVersion,
      eventName: input.eventName,
      payload: input.payload ?? {},
      outcome: 'APPLIED',
      rejectionReason: null,
    });
    if (inbox.duplicate) {
      return { outcome: 'DUPLICATE' as const };
    }

    const updated = await this.repo.markAuthorizationRevoked({
      authorizationId: input.authorizationId,
      revocationVersion: input.revocationVersion,
      revokedAt: input.revokedAt ? new Date(input.revokedAt) : new Date(),
      reasonCode: input.reasonCode ?? null,
      reference: input.reference ?? null,
    });

    await enqueueP7(
      this.outbox,
      createAuthorizationRevokedEvent({
        actorId: input.actorId,
        correlationId: randomUUID(),
        authorizationId: input.authorizationId,
        revocationVersion: input.revocationVersion,
      }),
    );
    if (this.audit) {
      await this.audit.create({
        eventType: 'provisioning.authorization.revoked',
        actorId: input.actorId,
        subjectType: 'PROVISIONING_AUTHORIZATION',
        subjectId: input.authorizationId,
        details: {
          revocationVersion: input.revocationVersion,
          status: updated?.revocationStatus ?? RevocationStatus.REVOKED,
        },
      });
    }
    return { outcome: 'APPLIED' as const, authorization: updated };
  }
}

export class ListProvisioningRequestsUseCase {
  constructor(private readonly repo: ProvisioningRepositoryPort) {}
  execute(filter: Parameters<ProvisioningRepositoryPort['listRequests']>[0]) {
    return this.repo.listRequests(filter);
  }
}

export class GetProvisioningRequestUseCase {
  constructor(private readonly repo: ProvisioningRepositoryPort) {}
  async execute(id: string) {
    const request = await this.repo.getRequestById(id);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Provisioning request not found');
    }
    return request;
  }
}

export class GetProvisioningRequestHistoryUseCase {
  constructor(private readonly repo: ProvisioningRepositoryPort) {}
  execute(requestId: string) {
    return this.repo.listRequestHistory(requestId);
  }
}

export class GetProvisioningRequestStatsUseCase {
  constructor(private readonly repo: ProvisioningRepositoryPort) {}
  execute() {
    return this.repo.getRequestStats();
  }
}

export class GetProvisioningAuthorizationSummaryUseCase {
  constructor(private readonly repo: ProvisioningRepositoryPort) {}
  async execute(authorizationRowId: string) {
    const auth = await this.repo.getAuthorizationById(authorizationRowId);
    if (!auth) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Authorization not found');
    }
    // Never expose cryptographic secrets — signature already redacted in snapshot.
    return {
      id: auth.id,
      authorizationId: auth.authorizationId,
      authorizationVersion: auth.authorizationVersion,
      operation: auth.operation,
      accountId: auth.accountId,
      productId: auth.productId,
      subscriptionId: auth.subscriptionId,
      decision: auth.decision,
      authorizationStatus: auth.authorizationStatus,
      revocationStatus: auth.revocationStatus,
      verificationStatus: auth.verificationStatus,
      verificationReasonCode: auth.verificationReasonCode,
      issuer: auth.issuer,
      audience: auth.audience,
      keyId: auth.keyId,
      signatureAlgorithm: auth.signatureAlgorithm,
      payloadDigest: auth.payloadDigest,
      issuedAt: auth.issuedAt,
      expiresAt: auth.expiresAt,
      environmentSlot: auth.environmentSlot,
      entitlementSnapshotReference: auth.entitlementSnapshotReference,
    };
  }
}

/** OQ-05 documentation helper — legacy event is never sufficient alone. */
export function mapLegacyProvisioningRequestedEvent(note?: string) {
  return {
    legacyEvent: LEGACY_PROVISIONING_REQUESTED_EVENT,
    policy: 'DUAL_CONSUME_WITH_EXPLICIT_MAPPING',
    rule: 'Legacy event must not be treated as canonical P5 authorization without verification',
    note: note ?? null,
  };
}
