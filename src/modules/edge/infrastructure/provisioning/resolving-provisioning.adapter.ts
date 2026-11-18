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
import { BbControlProvisioningAdapter } from './bb-control-provisioning.adapter.js';
import { DurableSubscriptionProvisioningAdapter } from './durable-provisioning.adapter.js';
import { LabBbProvisioningAdapter } from './lab-bb-provisioning.adapter.js';

/**
 * Default UNAVAILABLE (C-02).
 * Enable with EDGE_P7_PROVISIONING_ADAPTER=durable|bb_control|lab_bb.
 * - bb_control: production BB `/control/v1/provision` (non-empty entitlements)
 * - lab_bb: lab only — rejected at env parse in production
 * - durable: P7 authorization accept (workflow completion separate)
 */
@Injectable()
export class ResolvingSubscriptionProvisioningAdapter
  implements SubscriptionProvisioningCoordinationPort
{
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly unavailable: UnavailableSubscriptionProvisioningAdapter,
    private readonly durable: DurableSubscriptionProvisioningAdapter,
    private readonly labBb: LabBbProvisioningAdapter,
    private readonly bbControl: BbControlProvisioningAdapter,
  ) {}

  private adapter(): SubscriptionProvisioningCoordinationPort {
    const mode = this.config.EDGE_P7_PROVISIONING_ADAPTER;
    if (mode === 'durable') {
      return this.durable;
    }
    if (mode === 'bb_control') {
      return this.bbControl;
    }
    if (mode === 'lab_bb') {
      if (this.config.NODE_ENV === 'production') {
        return this.unavailable;
      }
      return this.labBb;
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
