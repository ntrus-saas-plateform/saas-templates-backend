import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';

export type LiveCompleteMode = 'LIVE' | 'PARTIAL' | 'UNAVAILABLE';

export type LiveCompleteStatusDto = {
  paymentAdapter: EnvironmentConfig['BILLING_PAYMENT_ADAPTER'];
  provisioningAdapter: EnvironmentConfig['EDGE_P7_PROVISIONING_ADAPTER'];
  bbControlConfigured: boolean;
  mode: LiveCompleteMode;
  note: string;
};

/**
 * Lab / operator readiness for live-complete adapters (no secrets).
 * Mode: LIVE when sandbox payment + durable P7 + BB control URL are set.
 */
@ApiTags('edge-live-complete')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeLiveCompleteController {
  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {}

  @Get('edge/live-complete/status')
  @RequireEdgePermissions(
    'platform:business:read',
    'platform:revenue:read',
    'platform:subscriptions:read',
    'platform:billing:accounts:read',
  )
  @ApiOperation({
    summary: 'Lab adapter status for live-complete (payment / P7 / BB control)',
  })
  getStatus(): LiveCompleteStatusDto {
    const paymentAdapter = this.config.BILLING_PAYMENT_ADAPTER;
    const provisioningAdapter = this.config.EDGE_P7_PROVISIONING_ADAPTER;
    const bbControlConfigured = Boolean(this.config.EDGE_BB_CONTROL_BASE_URL?.trim());

    let mode: LiveCompleteMode;
    if (
      paymentAdapter === 'sandbox' &&
      provisioningAdapter === 'durable' &&
      bbControlConfigured
    ) {
      mode = 'LIVE';
    } else if (paymentAdapter === 'unavailable' && provisioningAdapter === 'unavailable') {
      mode = 'UNAVAILABLE';
    } else {
      mode = 'PARTIAL';
    }

    return {
      paymentAdapter,
      provisioningAdapter,
      bbControlConfigured,
      mode,
      note:
        mode === 'LIVE'
          ? 'Sandbox payment, durable P7 provisioning, and BB control are configured.'
          : mode === 'PARTIAL'
            ? 'Some live-complete adapters are configured; lab is not fully LIVE.'
            : 'Lab needs BILLING_PAYMENT_ADAPTER=sandbox, EDGE_P7_PROVISIONING_ADAPTER=durable, and EDGE_BB_CONTROL_BASE_URL.',
    };
  }
}
