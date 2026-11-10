import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  ApproveHumanTaskUseCase,
  AssignHumanTaskUseCase,
  CancelWorkflowUseCase,
  CompleteCompensationUseCase,
  CompleteHumanTaskUseCase,
  CreateWorkflowDefinitionUseCase,
  CreateWorkflowInstanceUseCase,
  DeprecateWorkflowDefinitionUseCase,
  ListWorkflowResourcesUseCase,
  PauseWorkflowUseCase,
  PublishWorkflowDefinitionUseCase,
  ReconcileWorkflowUseCase,
  RejectHumanTaskUseCase,
  ResumeWorkflowUseCase,
  RetryWorkflowUseCase,
  StartCompensationUseCase,
  StartWorkflowUseCase,
  ValidateWorkflowDefinitionUseCase,
} from '../../application/workflow/workflow.use-cases.js';
import type { WorkflowDefinitionSnapshot } from '../../domain/workflow/workflow.types.js';
import {
  AssignWorkflowTaskDto,
  CreateWorkflowDefinitionDto,
  CreateWorkflowInstanceDto,
  DecideWorkflowTaskDto,
  DeprecateWorkflowDefinitionDto,
  RejectWorkflowTaskDto,
  RetryWorkflowDto,
  WorkflowHistoryQueryDto,
  WorkflowPaginationQueryDto,
  WorkflowReasonDto,
} from '../dto/workflow.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

function resolveIdempotencyKey(
  headerValue: string | string[] | undefined,
  bodyKey?: string,
): string | undefined {
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return (header?.trim() || bodyKey?.trim() || undefined) as string | undefined;
}

@ApiTags('edge-p7-workflows')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/workflows')
export class EdgeWorkflowController {
  constructor(
    private readonly lists: ListWorkflowResourcesUseCase,
    private readonly createDefinition: CreateWorkflowDefinitionUseCase,
    private readonly validateDefinition: ValidateWorkflowDefinitionUseCase,
    private readonly publishDefinition: PublishWorkflowDefinitionUseCase,
    private readonly deprecateDefinition: DeprecateWorkflowDefinitionUseCase,
    private readonly createInstance: CreateWorkflowInstanceUseCase,
    private readonly start: StartWorkflowUseCase,
    private readonly pause: PauseWorkflowUseCase,
    private readonly resume: ResumeWorkflowUseCase,
    private readonly cancel: CancelWorkflowUseCase,
    private readonly retry: RetryWorkflowUseCase,
    private readonly reconcile: ReconcileWorkflowUseCase,
    private readonly startCompensation: StartCompensationUseCase,
    private readonly completeCompensation: CompleteCompensationUseCase,
  ) {}

  @Get('definitions')
  @RequireEdgePermissions('platform:workflow_definition:read')
  listDefinitions(@Query() query: WorkflowPaginationQueryDto) {
    return this.lists.listDefinitions({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
    });
  }

  @Get('definitions/:id')
  @RequireEdgePermissions('platform:workflow_definition:read')
  async getDefinition(@Param('id') id: string) {
    const item = await this.lists.getDefinition(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Definition not found');
    return item;
  }

  @Post('definitions')
  @RequireEdgePermissions('platform:workflow_definition:manage')
  @ApiBody({ type: CreateWorkflowDefinitionDto })
  createDef(@Req() req: EdgeRequest, @Body() body: CreateWorkflowDefinitionDto) {
    return this.createDefinition.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      domain: body.domain,
      securityClassification: body.securityClassification,
      snapshot: body.snapshot as unknown as WorkflowDefinitionSnapshot,
    });
  }

  @Post('definitions/:id/validate')
  @RequireEdgePermissions('platform:workflow_definition:publish')
  validateDef(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.validateDefinition.execute({ actorId: actorId(req), definitionId: id });
  }

  @Post('definitions/:id/publish')
  @RequireEdgePermissions('platform:workflow_definition:publish')
  publishDef(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.publishDefinition.execute({ actorId: actorId(req), definitionId: id });
  }

  @Post('definitions/:id/deprecate')
  @RequireEdgePermissions('platform:workflow_definition:publish')
  @ApiBody({ type: DeprecateWorkflowDefinitionDto })
  deprecateDef(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: DeprecateWorkflowDefinitionDto,
  ) {
    return this.deprecateDefinition.execute({
      actorId: actorId(req),
      definitionId: id,
      reason: body.reason,
    });
  }

  @Get('dead-letters')
  @RequireEdgePermissions('platform:workflow:read')
  listDeadLetters(@Query() query: WorkflowPaginationQueryDto) {
    return this.lists.listDeadLetters({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
    });
  }

  @Get()
  @RequireEdgePermissions('platform:workflow:read')
  list(@Query() query: WorkflowPaginationQueryDto) {
    return this.lists.listInstances({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
    });
  }

  @Post()
  @RequireEdgePermissions('platform:workflow:manage')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiBody({ type: CreateWorkflowInstanceDto })
  create(
    @Req() req: EdgeRequest,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Body() body: CreateWorkflowInstanceDto,
  ) {
    const idempotencyKey = resolveIdempotencyKey(idempotencyHeader, body.idempotencyKey);
    if (!idempotencyKey) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header or body.idempotencyKey is required',
      );
    }
    return this.createInstance.execute({
      actorId: actorId(req),
      idempotencyKey,
      definitionId: body.definitionId,
      workflowType: body.workflowType,
      inputSnapshot: body.inputSnapshot,
      provisioningRequestId: body.provisioningRequestId,
      placementDecisionId: body.placementDecisionId,
      businessReference: body.businessReference,
      causationId: body.causationId,
    });
  }

  @Get(':id')
  @RequireEdgePermissions('platform:workflow:read')
  async get(@Param('id') id: string) {
    const item = await this.lists.getInstance(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found');
    return item;
  }

  @Get(':id/history')
  @RequireEdgePermissions('platform:workflow:read')
  history(@Param('id') id: string, @Query() query: WorkflowHistoryQueryDto) {
    return this.lists.listHistory({
      workflowId: id,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
    });
  }

  @Get(':id/steps')
  @RequireEdgePermissions('platform:workflow:read')
  steps(@Param('id') id: string) {
    return this.lists.listSteps(id);
  }

  @Get(':id/attempts')
  @RequireEdgePermissions('platform:workflow:read')
  attempts(@Param('id') id: string) {
    return this.lists.listAttempts(id);
  }

  @Get(':id/checkpoints')
  @RequireEdgePermissions('platform:workflow:read')
  checkpoints(@Param('id') id: string) {
    return this.lists.listCheckpoints(id);
  }

  @Get(':id/compensations')
  @RequireEdgePermissions('platform:workflow:read')
  compensations(@Param('id') id: string) {
    return this.lists.listCompensations(id);
  }

  @Post(':id/start')
  @RequireEdgePermissions('platform:workflow:manage')
  @ApiOperation({ summary: 'Start workflow (revalidates auth + COMMITTED placement)' })
  startWorkflow(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.start.execute({ actorId: actorId(req), workflowId: id });
  }

  @Post(':id/pause')
  @RequireEdgePermissions('platform:workflow:pause')
  @ApiBody({ type: WorkflowReasonDto })
  pauseWorkflow(@Req() req: EdgeRequest, @Param('id') id: string, @Body() body: WorkflowReasonDto) {
    return this.pause.execute({ actorId: actorId(req), workflowId: id, reason: body.reason });
  }

  @Post(':id/resume')
  @RequireEdgePermissions('platform:workflow:resume')
  resumeWorkflow(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.resume.execute({ actorId: actorId(req), workflowId: id });
  }

  @Post(':id/cancel')
  @RequireEdgePermissions('platform:workflow:cancel')
  @ApiBody({ type: WorkflowReasonDto })
  cancelWorkflow(@Req() req: EdgeRequest, @Param('id') id: string, @Body() body: WorkflowReasonDto) {
    return this.cancel.execute({ actorId: actorId(req), workflowId: id, reason: body.reason });
  }

  @Post(':id/retry')
  @RequireEdgePermissions('platform:workflow:retry')
  @ApiBody({ type: RetryWorkflowDto })
  retryWorkflow(@Req() req: EdgeRequest, @Param('id') id: string, @Body() body: RetryWorkflowDto) {
    return this.retry.execute({ actorId: actorId(req), workflowId: id, stepId: body.stepId });
  }

  @Post(':id/reconcile')
  @RequireEdgePermissions('platform:workflow:reconcile')
  reconcileWorkflow(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.reconcile.execute({ actorId: actorId(req), workflowId: id });
  }

  @Post(':id/compensation/start')
  @RequireEdgePermissions('platform:workflow:manage')
  startComp(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.startCompensation.execute({ actorId: actorId(req), workflowId: id });
  }

  @Post(':id/compensation/complete')
  @RequireEdgePermissions('platform:workflow:manage')
  completeComp(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { stepId: string; success: boolean; result?: Record<string, unknown> },
  ) {
    return this.completeCompensation.execute({
      actorId: actorId(req),
      workflowId: id,
      stepId: body.stepId,
      success: body.success,
      result: body.result,
    });
  }
}

@ApiTags('edge-p7-workflow-tasks')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/workflow-tasks')
export class EdgeWorkflowTasksController {
  constructor(
    private readonly lists: ListWorkflowResourcesUseCase,
    private readonly assign: AssignHumanTaskUseCase,
    private readonly approve: ApproveHumanTaskUseCase,
    private readonly reject: RejectHumanTaskUseCase,
    private readonly complete: CompleteHumanTaskUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:workflow_task:read')
  list(@Query() query: WorkflowPaginationQueryDto) {
    return this.lists.listTasks({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
    });
  }

  @Get(':id')
  @RequireEdgePermissions('platform:workflow_task:read')
  async get(@Param('id') id: string) {
    const item = await this.lists.getTask(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Task not found');
    return item;
  }

  @Post(':id/assign')
  @RequireEdgePermissions('platform:workflow_task:assign')
  @ApiBody({ type: AssignWorkflowTaskDto })
  assignTask(@Req() req: EdgeRequest, @Param('id') id: string, @Body() body: AssignWorkflowTaskDto) {
    return this.assign.execute({
      actorId: actorId(req),
      taskId: id,
      assignee: body.assignee,
    });
  }

  @Post(':id/approve')
  @RequireEdgePermissions('platform:workflow_task:approve')
  @ApiBody({ type: DecideWorkflowTaskDto })
  approveTask(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: DecideWorkflowTaskDto,
  ) {
    return this.approve.execute({ actorId: actorId(req), taskId: id, reason: body.reason });
  }

  @Post(':id/reject')
  @RequireEdgePermissions('platform:workflow_task:reject')
  @ApiBody({ type: RejectWorkflowTaskDto })
  rejectTask(@Req() req: EdgeRequest, @Param('id') id: string, @Body() body: RejectWorkflowTaskDto) {
    return this.reject.execute({ actorId: actorId(req), taskId: id, reason: body.reason });
  }

  @Post(':id/complete')
  @RequireEdgePermissions('platform:workflow_task:approve')
  completeTask(@Req() req: EdgeRequest, @Param('id') id: string) {
    return this.complete.execute({ actorId: actorId(req), taskId: id });
  }
}
