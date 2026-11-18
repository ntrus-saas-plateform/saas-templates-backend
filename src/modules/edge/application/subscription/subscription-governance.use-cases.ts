import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import type { SubscriptionTenantAssociationPort } from '../../domain/ports/subscription-tenant-association.port.js';
import { assertNoSelfApproval, SubscriptionStatus } from '../../domain/subscription/subscription.entity.js';
import {
  createEntitlementsReconciledEvent,
  createSubscriptionChangeApprovedEvent,
  EDGE_SUBSCRIPTION_OUTBOX_TENANT,
} from '../../domain/subscription/subscription.events.js';
import {
  projectResolvedEntitlementsToBbControl,
  resolvedFromSnapshotEntitlements,
} from '../../domain/subscription/bb-entitlement-projection.js';
import { assessEntitlementPayload } from '../../domain/provisioning/entitlement-payload.guard.js';
import type { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';
import { ExecuteChangeRequestUseCase } from './subscription.use-cases.js';

async function enqueueGovernance(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  event: IntegrationEvent<unknown>,
) {
  if (!outbox) return;
  await outbox.runWithOutbox(EDGE_SUBSCRIPTION_OUTBOX_TENANT, async (_c, enqueueFn) => {
    await enqueueFn(event);
  });
}

export class UpdateSubscriptionUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    metadata?: Record<string, unknown>;
    enterpriseProfile?: Record<string, unknown>;
    billingFrequency?: string | null;
    currency?: string;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    if (
      sub.status !== SubscriptionStatus.DRAFT &&
      sub.status !== SubscriptionStatus.PENDING_APPROVAL
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Only DRAFT or PENDING_APPROVAL subscriptions can be updated',
      );
    }
    return this.subscriptions.updateSubscription(sub.id, {
      metadata: input.metadata,
      enterpriseProfile: input.enterpriseProfile,
      billingFrequency: input.billingFrequency,
      currency: input.currency,
    });
  }
}

export class ApproveChangeRequestUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    changeId: string;
    decisionNote?: string;
  }) {
    const change = await this.subscriptions.getChangeRequest(input.changeId);
    if (!change || change.subscriptionId !== input.subscriptionId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change request not found');
    }
    if (change.approvalStatus !== 'PENDING') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Change is not pending approval');
    }
    const requesterId = change.requestedBy ?? input.actorId;
    assertNoSelfApproval({ requesterId, decisionBy: input.actorId });
    const correlationId = randomUUID();
    await this.subscriptions.createApproval({
      changeRequestId: change.id,
      subscriptionId: change.subscriptionId,
      approvalType: 'CHANGE_REQUEST',
      status: 'APPROVED',
      requestedBy: requesterId,
      decisionBy: input.actorId,
      decisionNote: input.decisionNote ?? null,
      decidedAt: new Date(),
    });
    const updated = await this.subscriptions.updateChangeRequest(change.id, {
      approvalStatus: 'APPROVED',
    });
    await enqueueGovernance(
      this.outbox,
      createSubscriptionChangeApprovedEvent({
        actorId: input.actorId,
        correlationId,
        subscriptionId: change.subscriptionId,
        changeRequestId: change.id,
      }),
    );
    return updated;
  }
}

export class RejectChangeRequestUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    changeId: string;
    decisionNote?: string;
  }) {
    const change = await this.subscriptions.getChangeRequest(input.changeId);
    if (!change || change.subscriptionId !== input.subscriptionId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change request not found');
    }
    if (change.approvalStatus !== 'PENDING') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Change is not pending approval');
    }
    const requesterId = change.requestedBy ?? input.actorId;
    assertNoSelfApproval({ requesterId, decisionBy: input.actorId });
    await this.subscriptions.createApproval({
      changeRequestId: change.id,
      subscriptionId: change.subscriptionId,
      approvalType: 'CHANGE_REQUEST',
      status: 'REJECTED',
      requestedBy: requesterId,
      decisionBy: input.actorId,
      decisionNote: input.decisionNote ?? null,
      decidedAt: new Date(),
    });
    return this.subscriptions.updateChangeRequest(change.id, {
      approvalStatus: 'REJECTED',
      executionStatus: 'CANCELLED',
    });
  }
}

export class ScheduleChangeUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    changeId: string;
    executeAt: string | Date;
  }) {
    const change = await this.subscriptions.getChangeRequest(input.changeId);
    if (!change || change.subscriptionId !== input.subscriptionId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Change request not found');
    }
    if (change.approvalStatus !== 'APPROVED') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Change must be approved before scheduling');
    }
    const executeAt =
      typeof input.executeAt === 'string' ? new Date(input.executeAt) : input.executeAt;
    const scheduled = await this.subscriptions.createScheduledChange({
      changeRequestId: change.id,
      executeAt,
      status: 'SCHEDULED',
    });
    await this.subscriptions.updateChangeRequest(change.id, {
      executionStatus: 'SCHEDULED',
    });
    return scheduled;
  }
}

export class ProposeRenewalUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}

  async execute(input: { actorId: string; subscriptionId: string; dueAt?: string | Date }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const dueAt = input.dueAt
      ? typeof input.dueAt === 'string'
        ? new Date(input.dueAt)
        : input.dueAt
      : sub.currentPeriodEnd ?? sub.renewalAt;
    return this.subscriptions.createRenewal({
      subscriptionId: sub.id,
      renewalStatus: 'OFFERED',
      offeredAt: new Date(),
      dueAt: dueAt ?? null,
      metadata: { proposedBy: input.actorId, statusLabel: 'PENDING' },
    });
  }
}

export class ReconcileEntitlementsUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly bbClient?: ControlV1BusinessBackendClient,
    private readonly associations?: SubscriptionTenantAssociationPort,
  ) {}

  async execute(input: {
    actorId: string;
    subscriptionId: string;
    /** When true and BB drift detected with configured client, re-PUT latest snapshot. */
    remediateBb?: boolean;
  }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const snapshot = await this.subscriptions.getLatestSnapshot(sub.id);
    if (!snapshot) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'No entitlement snapshot to reconcile');
    }
    const publications = await this.subscriptions.listPublications(sub.id);
    const lastPublished = publications.find((p) => p.status === 'PUBLISHED');
    const publicationDiverged = !lastPublished || lastPublished.snapshotId !== snapshot.id;
    const correlationId = randomUUID();

    let publication = lastPublished ?? null;
    if (publicationDiverged) {
      publication = await this.subscriptions.createPublication({
        subscriptionId: sub.id,
        snapshotId: snapshot.id,
        status: 'RECONCILED',
        correlationId,
      });
      await enqueueGovernance(
        this.outbox,
        createEntitlementsReconciledEvent({
          actorId: input.actorId,
          correlationId,
          subscriptionId: sub.id,
          snapshotId: snapshot.id,
          publicationId: publication.id,
        }),
      );
    }

    const activeAssociation = this.associations
      ? await this.associations.getActiveBySubscription(sub.id)
      : null;
    const tenantRef =
      activeAssociation?.productTenantRef ??
      (
        await this.subscriptions.listProvisioningRequests(sub.id)
      )
        .map((r) => r.tenantRef)
        .find((t): t is string => !!t?.trim()) ??
      (typeof sub.metadata?.tenantRef === 'string' ? sub.metadata.tenantRef : null) ??
      (typeof sub.metadata?.tenantId === 'string' ? sub.metadata.tenantId : null);

    const bbDrift: {
      checked: boolean;
      drifted: boolean;
      reason: string | null;
      edgeVersion: number;
      bbVersion: number | null;
      bbReady: boolean | null;
      remediated: boolean;
    } = {
      checked: false,
      drifted: false,
      reason: null,
      edgeVersion: snapshot.version,
      bbVersion: null,
      bbReady: null,
      remediated: false,
    };

    if (this.bbClient?.isConfigured() && tenantRef) {
      bbDrift.checked = true;
      const stateRes = await this.bbClient.getTenantState(tenantRef);
      const readyRes = await this.bbClient.getTenantReady(tenantRef);
      const bbVersion =
        typeof stateRes.body.entitlement_version === 'number'
          ? stateRes.body.entitlement_version
          : Number(stateRes.body.entitlement_version ?? NaN);
      bbDrift.bbVersion = Number.isFinite(bbVersion) ? bbVersion : null;
      bbDrift.bbReady = readyRes.body.ready === true;
      if (!stateRes.ok) {
        bbDrift.drifted = true;
        bbDrift.reason = `bb_state_http_${stateRes.status}`;
      } else if (bbDrift.bbVersion == null || bbDrift.bbVersion !== snapshot.version) {
        bbDrift.drifted = true;
        bbDrift.reason = 'entitlement_version_mismatch';
      } else if (readyRes.body.ready !== true) {
        bbDrift.drifted = true;
        bbDrift.reason =
          typeof readyRes.body.reason === 'string'
            ? readyRes.body.reason
            : 'bb_not_ready';
      }

      if (bbDrift.drifted && input.remediateBb === true) {
        const resolved = resolvedFromSnapshotEntitlements(
          snapshot.entitlements as Record<string, unknown>,
        );
        const projection = projectResolvedEntitlementsToBbControl(resolved);
        const emptiness = assessEntitlementPayload(projection.entitlements, projection.grants);
        if (emptiness.empty) {
          throw new DomainError(
            ErrorCode.VALIDATION_ERROR,
            `Cannot remediate BB drift with empty entitlements (${emptiness.reason})`,
          );
        }
        const put = await this.bbClient.putEntitlements(
          tenantRef,
          {
            entitlement_version: snapshot.version,
            entitlements: projection.entitlements,
            grants: [...projection.grants],
          },
          correlationId.slice(0, 128),
        );
        if (!put.ok) {
          throw new DomainError(
            ErrorCode.DEPENDENCY_UNAVAILABLE,
            `BB remediate failed: HTTP ${put.status}`,
            [{ status: put.status, body: put.body }],
          );
        }
        bbDrift.remediated = true;
        bbDrift.drifted = false;
        bbDrift.reason = null;
      }
    } else if (this.bbClient?.isConfigured() && !tenantRef) {
      bbDrift.checked = true;
      bbDrift.drifted = true;
      bbDrift.reason = 'tenant_ref_missing';
    }

    return {
      reconciled: publicationDiverged || bbDrift.remediated,
      publication,
      snapshot,
      diverged: publicationDiverged,
      association: activeAssociation,
      bbDrift,
      note: publicationDiverged
        ? 'Publication aligned to latest snapshot'
        : bbDrift.drifted
          ? `BB drift detected (${bbDrift.reason})`
          : bbDrift.checked
            ? 'Aligned with last publication and BB'
            : 'Aligned with last publication (BB not checked)',
    };
  }
}

export class ListPoliciesUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(opts?: Parameters<SubscriptionRepositoryPort['listPolicies']>[0]) {
    return this.subscriptions.listPolicies(opts);
  }
}

export class UpsertPolicyUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(input: Parameters<SubscriptionRepositoryPort['upsertPolicy']>[0]) {
    return this.subscriptions.upsertPolicy(input);
  }
}

export class GetCoordinationUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(subscriptionId: string) {
    const sub = await this.subscriptions.getById(subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    const [billing, provisioning] = await Promise.all([
      this.subscriptions.listBillingCoordination(subscriptionId),
      this.subscriptions.listProvisioningRequests(subscriptionId),
    ]);
    return { subscriptionId, billing, provisioning };
  }
}

export class ListPendingApprovalsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  execute(opts?: { limit?: number }) {
    return this.subscriptions.listApprovals({ status: 'PENDING', limit: opts?.limit });
  }
}

export class ListSubscriptionPublicationsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(subscriptionId: string) {
    const sub = await this.subscriptions.getById(subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');
    return this.subscriptions.listPublications(subscriptionId);
  }
}

export class ListSubscriptionSuspensionsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(subscriptionId: string) {
    return this.subscriptions.listSuspensions(subscriptionId);
  }
}

export class ListSubscriptionCancellationsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort) {}
  async execute(subscriptionId: string) {
    return this.subscriptions.listCancellations(subscriptionId);
  }
}

/**
 * Operator/cron entrypoint: scan active subscriptions for Edge↔BB entitlement drift.
 * Failures are recorded per subscription; batch continues (no infinite retries).
 */
export class ProcessEntitlementDriftBatchUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly reconcile: ReconcileEntitlementsUseCase,
  ) {}

  async execute(input: {
    actorId: string;
    remediateBb?: boolean;
    limit?: number;
    status?: string;
  }) {
    const page = await this.subscriptions.listSubscriptions({
      status: input.status ?? 'ACTIVE',
      limit: input.limit ?? 50,
      offset: 0,
    });
    const results: Array<{
      subscriptionId: string;
      outcome: 'ALIGNED' | 'DRIFTED' | 'REMEDIATED' | 'FAILED' | 'SKIPPED';
      note?: string;
      bbDrift?: unknown;
    }> = [];

    for (const sub of page.items) {
      try {
        const snapshot = await this.subscriptions.getLatestSnapshot(sub.id);
        if (!snapshot) {
          results.push({
            subscriptionId: sub.id,
            outcome: 'SKIPPED',
            note: 'no_snapshot',
          });
          continue;
        }
        const report = await this.reconcile.execute({
          actorId: input.actorId,
          subscriptionId: sub.id,
          remediateBb: input.remediateBb === true,
        });
        const drift = report.bbDrift as
          | { drifted?: boolean; remediated?: boolean; reason?: string | null }
          | undefined;
        if (drift?.remediated) {
          results.push({
            subscriptionId: sub.id,
            outcome: 'REMEDIATED',
            bbDrift: drift,
            note: report.note,
          });
        } else if (drift?.drifted || report.diverged) {
          results.push({
            subscriptionId: sub.id,
            outcome: 'DRIFTED',
            bbDrift: drift,
            note: report.note,
          });
        } else {
          results.push({
            subscriptionId: sub.id,
            outcome: 'ALIGNED',
            bbDrift: drift,
            note: report.note,
          });
        }
      } catch (error) {
        results.push({
          subscriptionId: sub.id,
          outcome: 'FAILED',
          note: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const drifted = results.filter((r) => r.outcome === 'DRIFTED' || r.outcome === 'FAILED');
    return {
      scanned: results.length,
      driftedCount: drifted.length,
      remediatedCount: results.filter((r) => r.outcome === 'REMEDIATED').length,
      results,
      alert:
        drifted.length > 0
          ? {
              severity: 'WARNING',
              code: 'ENTITLEMENT_DRIFT_DETECTED',
              message: `${drifted.length}/${results.length} subscription(s) drifted or failed reconcile`,
            }
          : null,
    };
  }
}

/**
 * Operator/cron entrypoint: execute due scheduled changes idempotently.
 * No infinite retries — failed executions are marked FAILED on the change request.
 */
export class ProcessDueScheduledChangesUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly executeChange: ExecuteChangeRequestUseCase,
  ) {}

  async execute(input: { actorId: string; asOf?: Date }) {
    const due = await this.subscriptions.listDueScheduledChanges(input.asOf);
    const results: Array<{
      scheduledChangeId: string;
      changeRequestId: string;
      subscriptionId: string;
      outcome: 'EXECUTED' | 'FAILED';
      error?: string;
    }> = [];
    for (const row of due) {
      try {
        await this.executeChange.execute({
          actorId: input.actorId,
          subscriptionId: row.subscriptionId,
          changeId: row.changeRequestId,
        });
        results.push({
          scheduledChangeId: row.id,
          changeRequestId: row.changeRequestId,
          subscriptionId: row.subscriptionId,
          outcome: 'EXECUTED',
        });
      } catch (error) {
        await this.subscriptions.updateChangeRequest(row.changeRequestId, {
          executionStatus: 'FAILED',
        });
        results.push({
          scheduledChangeId: row.id,
          changeRequestId: row.changeRequestId,
          subscriptionId: row.subscriptionId,
          outcome: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { processed: results.length, results };
  }
}
