import { Injectable } from '@nestjs/common';
import type {
  ProvisioningCompleteInput,
  ProvisioningCompleteResult,
  ProvisioningRequestInput,
  ProvisioningRequestResult,
  SubscriptionProvisioningCoordinationPort,
} from '../../domain/subscription/provisioning-coordination.port.js';

@Injectable()
export class UnavailableSubscriptionProvisioningAdapter
  implements SubscriptionProvisioningCoordinationPort
{
  async requestProvisioning(
    _input: ProvisioningRequestInput,
  ): Promise<ProvisioningRequestResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage:
        'No provisioning provider configured; P5 does not create tenants or Keycloak orgs',
    };
  }

  async completeProvisioning(
    _input: ProvisioningCompleteInput,
  ): Promise<ProvisioningCompleteResult> {
    return {
      outcome: 'UNAVAILABLE',
      failureCode: 'PROVIDER_NOT_CONFIGURED',
      failureMessage:
        'No provisioning provider configured; complete only via explicit integration',
    };
  }
}
