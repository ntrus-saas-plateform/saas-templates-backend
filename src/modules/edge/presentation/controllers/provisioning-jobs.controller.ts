import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { ProcessProvisioningJobsUseCase } from '../../application/provisioning/process-provisioning-jobs.use-case.js';
import {
  PROVISIONING_JOB_PORT,
  type ProvisioningJobPort,
} from '../../domain/provisioning/provisioning-job.port.js';

/**
 * Operator / worker surface for durable provisioning jobs (doc 39 W3 / H1).
 * Not a public acquisition API. Not a 50k/s claim.
 */
@ApiTags('Edge Provisioning Jobs')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/provisioning-jobs')
export class EdgeProvisioningJobsController {
  constructor(
    private readonly processJobs: ProcessProvisioningJobsUseCase,
    @Inject(PROVISIONING_JOB_PORT)
    private readonly jobs: ProvisioningJobPort,
  ) {}

  @Post('process')
  @RequireEdgePermissions('platform:subscriptions:manage_integrations')
  process(@Body() body?: { limit?: number }) {
    return this.processJobs.execute({
      limit: body?.limit,
      actorId: 'provisioning-worker',
    });
  }

  @Get('by-subscription/:subscriptionId')
  @RequireEdgePermissions('platform:subscriptions:read')
  listBySubscription(@Param('subscriptionId', ParseUUIDPipe) subscriptionId: string) {
    return this.jobs.listBySubscription(subscriptionId);
  }
}
