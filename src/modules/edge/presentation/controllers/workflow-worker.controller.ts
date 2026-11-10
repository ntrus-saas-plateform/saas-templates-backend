import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  ClaimStepUseCase,
  CompleteStepUseCase,
  FailStepUseCase,
  ListWorkflowResourcesUseCase,
  RenewLeaseUseCase,
  WorkerHeartbeatUseCase,
} from '../../application/workflow/workflow.use-cases.js';
import {
  ClaimStepDto,
  CompleteStepDto,
  FailStepDto,
  RenewLeaseDto,
  WorkerHeartbeatDto,
  WorkflowPaginationQueryDto,
} from '../dto/workflow.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

@ApiTags('edge-p7-workflow-workers')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/workflow-workers')
export class EdgeWorkflowWorkerController {
  constructor(
    private readonly lists: ListWorkflowResourcesUseCase,
    private readonly claim: ClaimStepUseCase,
    private readonly renew: RenewLeaseUseCase,
    private readonly complete: CompleteStepUseCase,
    private readonly fail: FailStepUseCase,
    private readonly heartbeat: WorkerHeartbeatUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:workflow:read')
  @ApiOperation({ summary: 'List registered workers (no secrets)' })
  listWorkers(@Query() query: WorkflowPaginationQueryDto) {
    return this.lists.listWorkers({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
    });
  }

  @Post('heartbeat')
  @RequireEdgePermissions('platform:workflow:worker')
  @ApiOperation({ summary: 'Worker heartbeat / registration' })
  @ApiBody({ type: WorkerHeartbeatDto })
  beat(@Body() body: WorkerHeartbeatDto) {
    return this.heartbeat.execute(body);
  }

  @Post('claim')
  @RequireEdgePermissions('platform:workflow:worker')
  @ApiOperation({ summary: 'Atomically claim next eligible step (FOR UPDATE SKIP LOCKED)' })
  @ApiBody({ type: ClaimStepDto })
  claimStep(@Body() body: ClaimStepDto) {
    return this.claim.execute({
      workerId: body.workerId,
      leaseMs: body.leaseMs,
    });
  }

  @Post('steps/:stepId/renew')
  @RequireEdgePermissions('platform:workflow:worker')
  @ApiBody({ type: RenewLeaseDto })
  renewLease(@Param('stepId') stepId: string, @Body() body: RenewLeaseDto) {
    return this.renew.execute({
      stepId,
      workerId: body.workerId,
      fencingToken: body.fencingToken,
      expectedVersion: body.expectedVersion,
      leaseMs: body.leaseMs,
    });
  }

  @Post('steps/:stepId/complete')
  @RequireEdgePermissions('platform:workflow:worker')
  @ApiBody({ type: CompleteStepDto })
  completeStep(
    @Req() req: EdgeRequest,
    @Param('stepId') stepId: string,
    @Body() body: CompleteStepDto,
  ) {
    return this.complete.execute({
      actorId: actorId(req),
      stepId,
      workerId: body.workerId,
      fencingToken: body.fencingToken,
      expectedVersion: body.expectedVersion,
      outputSnapshot: body.outputSnapshot,
      checkpoint: body.checkpoint,
    });
  }

  @Post('steps/:stepId/fail')
  @RequireEdgePermissions('platform:workflow:worker')
  @ApiBody({ type: FailStepDto })
  failStep(@Req() req: EdgeRequest, @Param('stepId') stepId: string, @Body() body: FailStepDto) {
    return this.fail.execute({
      actorId: actorId(req),
      stepId,
      workerId: body.workerId,
      fencingToken: body.fencingToken,
      expectedVersion: body.expectedVersion,
      errorClass: body.errorClass,
      diagnostics: body.diagnostics,
    });
  }
}
