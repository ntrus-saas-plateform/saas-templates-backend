import { Inject, Injectable, Optional } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import type {
  TenantRuntimeStatusPort,
  TenantRuntimeStatusResult,
} from '../../domain/acquisition/tenant-runtime-status.port.js';
import {
  CONTROL_V1_BB_CLIENT_PORT,
  type ControlV1BusinessBackendClient,
} from '../product-control/control-v1-business-backend.client.js';
import { ControlV1TenantRuntimeStatusAdapter } from './control-v1-tenant-runtime-status.adapter.js';
import { UnavailableTenantRuntimeStatusAdapter } from './unavailable-tenant-runtime-status.adapter.js';

/**
 * If EDGE_BB_CONTROL_BASE_URL set → control-v1 adapter; else UNAVAILABLE.
 */
@Injectable()
export class ResolvingTenantRuntimeStatusAdapter implements TenantRuntimeStatusPort {
  private readonly delegate: TenantRuntimeStatusPort;

  constructor(
    @Inject(APP_CONFIG) config: EnvironmentConfig,
    @Optional()
    @Inject(CONTROL_V1_BB_CLIENT_PORT)
    bbClient?: ControlV1BusinessBackendClient | null,
  ) {
    const baseUrl = config.EDGE_BB_CONTROL_BASE_URL?.trim();
    if (baseUrl && bbClient?.isConfigured()) {
      this.delegate = new ControlV1TenantRuntimeStatusAdapter(bbClient);
    } else {
      this.delegate = new UnavailableTenantRuntimeStatusAdapter();
    }
  }

  isTenantReady(tenantId: string): Promise<TenantRuntimeStatusResult> {
    return this.delegate.isTenantReady(tenantId);
  }
}
