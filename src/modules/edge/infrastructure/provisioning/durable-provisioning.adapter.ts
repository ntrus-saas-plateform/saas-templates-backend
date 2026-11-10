import { Injectable } from '@nestjs/common';
import type {
  ProvisioningCompleteInput,
  ProvisioningCompleteResult,
  ProvisioningRequestInput,
  ProvisioningRequestResult,
  SubscriptionProvisioningCoordinationPort,
} from '../../domain/subscription/provisioning-coordination.port.js';
import type { AcceptProvisioningAuthorizationUseCase } from '../../application/provisioning/provisioning.use-cases.js';
import type { CanonicalProvisioningAuthorization } from '../../domain/provisioning/provisioning.types.js';

/**
 * Feature-flagged P7 durable adapter.
 * Requires a canonical authorization object in payload.authorization.
 * Never invents success without verification. Never creates tenants/KC/DB.
 */
@Injectable()
export class DurableSubscriptionProvisioningAdapter
  implements SubscriptionProvisioningCoordinationPort
{
  constructor(private readonly accept: AcceptProvisioningAuthorizationUseCase) {}

  async requestProvisioning(
    input: ProvisioningRequestInput,
  ): Promise<ProvisioningRequestResult> {
    const raw = input.payload?.['authorization'];
    if (!raw || typeof raw !== 'object') {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'CANONICAL_AUTHORIZATION_REQUIRED',
        failureMessage:
          'P7 durable adapter requires payload.authorization (C-09). Legacy subscriptionId alone is insufficient.',
      };
    }

    const authorization = raw as CanonicalProvisioningAuthorization;
    const result = await this.accept.execute({
      actorId: 'p5-coordination',
      authorization,
      source: 'P5_COORDINATION',
      expectedAccountId: input.accountId,
      expectedProductId: input.productId,
      expectedSubscriptionId: input.subscriptionId,
    });

    if (result.outcome === 'ACCEPTED' || result.outcome === 'IDEMPOTENT_REPLAY') {
      if (result.request.requestStatus === 'ACCEPTED') {
        return { outcome: 'ACCEPTED', externalRef: result.request.id };
      }
      if (result.request.requestStatus === 'REQUESTED') {
        return { outcome: 'REQUESTED', externalRef: result.request.id };
      }
      return {
        outcome: 'UNAVAILABLE',
        failureCode: result.request.rejectionReasonCode ?? 'REQUEST_NOT_ACCEPTED',
        failureMessage: `Provisioning request status=${result.request.requestStatus}`,
      };
    }

    return {
      outcome: 'UNAVAILABLE',
      failureCode: result.reasonCode ?? 'AUTHORIZATION_REJECTED',
      failureMessage: `Authorization rejected: ${result.reasonCode ?? 'unknown'}`,
    };
  }

  async completeProvisioning(
    _input: ProvisioningCompleteInput,
  ): Promise<ProvisioningCompleteResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'P7_1_NO_TECHNICAL_COMPLETION',
      failureMessage:
        'P7.1 does not complete technical provisioning (no tenant/KC/DB). Completion belongs to later phases.',
    };
  }
}
