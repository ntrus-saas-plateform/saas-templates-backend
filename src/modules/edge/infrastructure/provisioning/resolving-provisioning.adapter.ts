import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import type {
  ProvisioningCompleteInput,
  ProvisioningCompleteResult,
  ProvisioningRequestInput,
  ProvisioningRequestResult,
  SubscriptionProvisioningCoordinationPort,
} from '../../domain/subscription/provisioning-coordination.port.js';
import { UnavailableSubscriptionProvisioningAdapter } from '../subscription/unavailable-provisioning.adapter.js';
import { DurableSubscriptionProvisioningAdapter } from './durable-provisioning.adapter.js';

/**
 * Default UNAVAILABLE (C-02). Enable with EDGE_P7_PROVISIONING_ADAPTER=durable.
 * Never permissive when misconfigured.
 */
@Injectable()
export class ResolvingSubscriptionProvisioningAdapter
  implements SubscriptionProvisioningCoordinationPort
{
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly unavailable: UnavailableSubscriptionProvisioningAdapter,
    private readonly durable: DurableSubscriptionProvisioningAdapter,
  ) {}

  private adapter(): SubscriptionProvisioningCoordinationPort {
    if (this.config.EDGE_P7_PROVISIONING_ADAPTER === 'durable') {
      return this.durable;
    }
    return this.unavailable;
  }

  requestProvisioning(input: ProvisioningRequestInput): Promise<ProvisioningRequestResult> {
    return this.adapter().requestProvisioning(input);
  }

  completeProvisioning(input: ProvisioningCompleteInput): Promise<ProvisioningCompleteResult> {
    return this.adapter().completeProvisioning(input);
  }
}
