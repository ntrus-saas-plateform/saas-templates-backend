import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { SubscriptionProvisioningCoordinationPort } from '../../domain/subscription/provisioning-coordination.port.js';
import type { SubscriptionRepositoryPort } from '../../domain/subscription/subscription.repository.port.js';
import { ActivateSubscriptionUseCase } from './subscription.use-cases.js';
import { CalculateAndSnapshotEntitlementsUseCase } from './subscription.use-cases.js';
import { CompleteProvisioningUseCase } from './subscription.use-cases.js';
import { PublishEntitlementsUseCase } from './subscription.use-cases.js';

/**
 * RGOM — after invoice PAID + RequestProvisioning accepted:
 * poll BB ready → complete → snapshot → publish → activate (best-effort, fail-closed notes).
 */
export class AdvanceProvisioningAfterPaidUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly provisioning: SubscriptionProvisioningCoordinationPort,
    private readonly completeProvisioning: CompleteProvisioningUseCase,
    private readonly calculateSnapshot: CalculateAndSnapshotEntitlementsUseCase,
    private readonly publishEntitlements: PublishEntitlementsUseCase,
    private readonly activateSubscription?: ActivateSubscriptionUseCase,
  ) {}

  async execute(input: { actorId: string; subscriptionId: string }) {
    const sub = await this.subscriptions.getById(input.subscriptionId);
    if (!sub) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription not found');

    const reqs = await this.subscriptions.listProvisioningRequests(sub.id);
    const latest = [...reqs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    if (!latest) {
      return { advanced: false, reason: 'NO_PROVISIONING_REQUEST' };
    }
    if (String(latest.outcome).toUpperCase() === 'COMPLETE' && sub.provisioningConfirmed) {
      return { advanced: false, reason: 'ALREADY_COMPLETE', requestId: latest.id };
    }
    if (!['ACCEPTED', 'REQUESTED', 'COMPLETE'].includes(String(latest.outcome).toUpperCase())) {
      return {
        advanced: false,
        reason: 'PROVISIONING_NOT_ACCEPTED',
        outcome: latest.outcome,
        requestId: latest.id,
      };
    }

    const tenantRef = latest.tenantRef ?? latest.externalRef ?? null;
    const poll = await this.provisioning.completeProvisioning({
      subscriptionId: sub.id,
      requestId: latest.id,
      externalRef: latest.externalRef,
      tenantRef,
    });

    if (poll.outcome === 'NOT_COMPLETE') {
      return {
        advanced: false,
        reason: 'TENANT_NOT_READY',
        requestId: latest.id,
        tenantRef,
        failureCode: poll.failureCode,
      };
    }
    if (poll.outcome === 'UNAVAILABLE') {
      return {
        advanced: false,
        reason: 'READY_POLL_UNAVAILABLE',
        requestId: latest.id,
        failureCode: poll.failureCode,
        failureMessage: poll.failureMessage,
      };
    }

    const completed = await this.completeProvisioning.execute({
      actorId: input.actorId,
      subscriptionId: sub.id,
      requestId: latest.id,
      tenantRef: tenantRef ?? undefined,
      externalRef: latest.externalRef ?? undefined,
      skipReadyPoll: true,
    });

    const snapshot = await this.calculateSnapshot.execute({
      actorId: input.actorId,
      subscriptionId: sub.id,
      reason: 'post_paid_provision_ready',
    });

    let publication: unknown = null;
    try {
      publication = await this.publishEntitlements.execute({
        actorId: input.actorId,
        subscriptionId: sub.id,
        snapshotId: snapshot.id,
      });
    } catch (err) {
      return {
        advanced: true,
        ready: true,
        provisioningCompleted: completed,
        snapshotId: snapshot.id,
        publishError: err instanceof Error ? err.message : String(err),
        activated: false,
      };
    }

    let activated: unknown = null;
    let activateError: string | null = null;
    if (this.activateSubscription) {
      try {
        activated = await this.activateSubscription.execute({
          actorId: input.actorId,
          subscriptionId: sub.id,
        });
      } catch (err) {
        activateError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      advanced: true,
      ready: true,
      requestId: latest.id,
      tenantRef,
      provisioningCompleted: completed,
      snapshotId: snapshot.id,
      publication,
      activated,
      activateError,
    };
  }
}
