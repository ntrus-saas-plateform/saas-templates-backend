import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';
import type { IntegrationEventHandler } from '../../../../core/domain/ports/integration-event-handler.port.js';
import { CompleteSubscriptionHandoffUseCase } from '../../application/acquisition/acquisition.use-cases.js';
import { CreateSubscriptionUseCase } from '../../application/subscription/subscription.use-cases.js';
import { AcquisitionEventTypes } from '../../domain/acquisition/acquisition.events.js';
import {
  ACQUISITION_REPOSITORY_PORT,
  type AcquisitionRepositoryPort,
} from '../../domain/acquisition/acquisition-repository.port.js';

function metaString(
  metadata: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const v = metadata[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * P10 → P5 bridge: subscription handoff requested creates a real P5 subscription
 * then completes the acquisition handoff with evidence. Honest failures only —
 * never invents commercialAccountId / commercialPlanId / productId.
 */
@Injectable()
export class P10SubscriptionHandoffHandler implements IntegrationEventHandler {
  constructor(
    @Inject(ACQUISITION_REPOSITORY_PORT)
    private readonly acquisition: AcquisitionRepositoryPort,
    private readonly createSubscription: CreateSubscriptionUseCase,
    private readonly completeHandoff: CompleteSubscriptionHandoffUseCase,
  ) {}

  supports(eventType: string): boolean {
    return eventType === AcquisitionEventTypes.SUBSCRIPTION_HANDOFF_REQUESTED;
  }

  async handle(event: IntegrationEvent): Promise<void> {
    const handoffId = event.aggregateId?.trim();
    if (!handoffId) return;

    const handoff = await this.acquisition.getSubscriptionHandoff(handoffId);
    if (!handoff) return;

    if (handoff.status === 'COMPLETED' && handoff.subscriptionRef) {
      return;
    }
    if (handoff.status === 'FAILED' || handoff.status === 'CANCELLED') {
      return;
    }

    const actorId =
      event.actor?.id && event.actor.id !== 'system'
        ? event.actor.id
        : 'system:p10-subscription-handoff';
    const correlationId =
      event.correlationId?.trim() || `p10-handoff:${handoff.id}`;

    let commercialAccountId = handoff.commercialAccountId?.trim() || null;
    let commercialPlanId = handoff.commercialPlanId?.trim() || null;
    let productId = metaString(handoff.metadata, 'productId');

    if (handoff.applicationId) {
      const application = await this.acquisition.getApplication(handoff.applicationId);
      if (application) {
        productId =
          productId ||
          application.productId?.trim() ||
          metaString(application.metadata, 'productId');
        commercialPlanId =
          commercialPlanId ||
          application.commercialPlanId?.trim() ||
          metaString(application.metadata, 'commercialPlanId', 'planId');
      }
    }

    if (!productId || !commercialAccountId || !commercialPlanId) {
      const prospect = await this.acquisition.getProspect(handoff.prospectId);
      if (prospect) {
        productId = productId || prospect.productId?.trim() || null;
        commercialAccountId =
          commercialAccountId || prospect.commercialAccountId?.trim() || null;
        commercialPlanId =
          commercialPlanId || prospect.commercialPlanId?.trim() || null;
      }
    }

    commercialPlanId =
      commercialPlanId ||
      metaString(handoff.metadata, 'commercialPlanId', 'planId');

    if (!commercialAccountId || !commercialPlanId || !productId) {
      const missing = [
        !commercialAccountId ? 'commercialAccountId' : null,
        !commercialPlanId ? 'commercialPlanId' : null,
        !productId ? 'productId' : null,
      ]
        .filter(Boolean)
        .join(', ');
      await this.acquisition.transitionSubscriptionHandoff(handoff.id, 'FAILED', {
        failureReason: `Cannot create P5 subscription: missing ${missing}`,
      });
      return;
    }

    const idempotencyScope = 'p10_subscription_handoff';
    const idem = await this.acquisition.beginIdempotency({
      scope: idempotencyScope,
      idempotencyKey: handoff.id,
      metadata: { correlationId },
    });
    if (idem.status === 'COMPLETED' && idem.responseRef) {
      return;
    }

    try {
      const sub = await this.createSubscription.execute({
        actorId,
        accountId: commercialAccountId,
        productId,
        planId: commercialPlanId,
        correlationId,
      });
      await this.completeHandoff.execute({
        actorId,
        handoffId: handoff.id,
        subscriptionId: sub.id,
        externalEvidenceRef: `p5:${sub.id}`,
        correlationId,
      });
      await this.acquisition.completeIdempotency(
        idempotencyScope,
        handoff.id,
        sub.id,
        'COMPLETED',
      );
    } catch (err) {
      await this.acquisition.completeIdempotency(
        idempotencyScope,
        handoff.id,
        null,
        'FAILED',
      );
      const message =
        err instanceof DomainError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown subscription handoff failure';
      await this.acquisition.transitionSubscriptionHandoff(handoff.id, 'FAILED', {
        failureReason: message,
      });
    }
  }
}
