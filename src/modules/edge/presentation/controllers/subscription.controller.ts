import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  ActivateSubscriptionUseCase,
  AddSubscriptionItemUseCase,
  ApproveSubscriptionUseCase,
  CalculateAndSnapshotEntitlementsUseCase,
  CancelSubscriptionUseCase,
  ConfirmBillingCoordinationUseCase,
  CompleteProvisioningUseCase,
  ConvertTrialUseCase,
  CreateChangeRequestUseCase,
  CreateSubscriptionFromHandoffUseCase,
  CreateSubscriptionUseCase,
  ExecuteChangeRequestUseCase,
  ExpireTrialUseCase,
  GetSubscriptionAnalyticsUseCase,
  GetSubscriptionHistoryUseCase,
  GetSubscriptionOverviewUseCase,
  GetSubscriptionUseCase,
  GetSubscriptionWorkspaceUseCase,
  ListChangeRequestsUseCase,
  ListEntitlementSnapshotsUseCase,
  ListRenewalsUseCase,
  ListSubscriptionItemsUseCase,
  ListSubscriptionsUseCase,
  ListTrialsUseCase,
  PublishEntitlementsUseCase,
  ReactivateSubscriptionUseCase,
  RenewSubscriptionUseCase,
  RequestActivationUseCase,
  RequestBillingCoordinationUseCase,
  RequestProvisioningUseCase,
  StartTrialUseCase,
  SubmitSubscriptionUseCase,
  SuspendSubscriptionUseCase,
  TerminateSubscriptionUseCase,
  ResolveSubscriptionIdempotencyUseCase,
} from '../../application/subscription/subscription.use-cases.js';
import {
  ApproveChangeRequestUseCase,
  GetCoordinationUseCase,
  ListPendingApprovalsUseCase,
  ListPoliciesUseCase,
  ListSubscriptionCancellationsUseCase,
  ListSubscriptionPublicationsUseCase,
  ListSubscriptionSuspensionsUseCase,
  ProcessDueScheduledChangesUseCase,
  ProposeRenewalUseCase,
  ReconcileEntitlementsUseCase,
  RejectChangeRequestUseCase,
  ScheduleChangeUseCase,
  UpdateSubscriptionUseCase,
  UpsertPolicyUseCase,
} from '../../application/subscription/subscription-governance.use-cases.js';

@ApiTags('edge-subscriptions')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/subscriptions')
export class EdgeSubscriptionController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly overview: GetSubscriptionOverviewUseCase,
    private readonly analytics: GetSubscriptionAnalyticsUseCase,
    private readonly listSubs: ListSubscriptionsUseCase,
    private readonly getSub: GetSubscriptionUseCase,
    private readonly getWorkspace: GetSubscriptionWorkspaceUseCase,
    private readonly createSub: CreateSubscriptionUseCase,
    private readonly createFromHandoff: CreateSubscriptionFromHandoffUseCase,
    private readonly submit: SubmitSubscriptionUseCase,
    private readonly approve: ApproveSubscriptionUseCase,
    private readonly requestActivation: RequestActivationUseCase,
    private readonly activate: ActivateSubscriptionUseCase,
    private readonly suspend: SuspendSubscriptionUseCase,
    private readonly reactivate: ReactivateSubscriptionUseCase,
    private readonly cancel: CancelSubscriptionUseCase,
    private readonly terminate: TerminateSubscriptionUseCase,
    private readonly listItems: ListSubscriptionItemsUseCase,
    private readonly addItem: AddSubscriptionItemUseCase,
    private readonly calculateEntitlements: CalculateAndSnapshotEntitlementsUseCase,
    private readonly listEntitlements: ListEntitlementSnapshotsUseCase,
    private readonly publishEntitlements: PublishEntitlementsUseCase,
    private readonly listChanges: ListChangeRequestsUseCase,
    private readonly createChange: CreateChangeRequestUseCase,
    private readonly executeChange: ExecuteChangeRequestUseCase,
    private readonly renew: RenewSubscriptionUseCase,
    private readonly listRenewals: ListRenewalsUseCase,
    private readonly listTrials: ListTrialsUseCase,
    private readonly startTrial: StartTrialUseCase,
    private readonly convertTrial: ConvertTrialUseCase,
    private readonly expireTrial: ExpireTrialUseCase,
    private readonly requestBilling: RequestBillingCoordinationUseCase,
    private readonly confirmBilling: ConfirmBillingCoordinationUseCase,
    private readonly requestProvisioning: RequestProvisioningUseCase,
    private readonly completeProvisioningUseCase: CompleteProvisioningUseCase,
    private readonly history: GetSubscriptionHistoryUseCase,
    private readonly updateSub: UpdateSubscriptionUseCase,
    private readonly approveChange: ApproveChangeRequestUseCase,
    private readonly rejectChange: RejectChangeRequestUseCase,
    private readonly scheduleChange: ScheduleChangeUseCase,
    private readonly proposeRenewal: ProposeRenewalUseCase,
    private readonly reconcileEntitlements: ReconcileEntitlementsUseCase,
    private readonly listPolicies: ListPoliciesUseCase,
    private readonly upsertPolicy: UpsertPolicyUseCase,
    private readonly pendingApprovals: ListPendingApprovalsUseCase,
    private readonly coordination: GetCoordinationUseCase,
    private readonly listSuspensions: ListSubscriptionSuspensionsUseCase,
    private readonly listCancellations: ListSubscriptionCancellationsUseCase,
    private readonly listPublications: ListSubscriptionPublicationsUseCase,
    private readonly processDueChanges: ProcessDueScheduledChangesUseCase,
    private readonly idempotency: ResolveSubscriptionIdempotencyUseCase,
  ) {}

  private actorId(): string {
    return this.edgeContext.getOrThrow().administratorId!;
  }

  @Get('overview')
  @RequireEdgePermissions('platform:subscriptions:read_analytics')
  overviewDashboard() {
    return this.overview.execute();
  }

  @Get('analytics')
  @RequireEdgePermissions('platform:subscriptions:read_analytics')
  analyticsDashboard() {
    return this.analytics.execute();
  }

  @Get('policies')
  @RequireEdgePermissions('platform:subscriptions:manage_policies')
  policies(@Query('status') status?: string) {
    return this.listPolicies.execute(status ? { status } : undefined);
  }

  @Put('policies/:code')
  @RequireEdgePermissions('platform:subscriptions:manage_policies')
  putPolicy(
    @Param('code') code: string,
    @Body()
    body: {
      policyType?: string;
      rules?: Record<string, unknown>;
      status?: string;
    },
  ) {
    return this.upsertPolicy.execute({ code, ...body });
  }

  @Get('approvals')
  @RequireEdgePermissions('platform:subscriptions:manage_approvals')
  approvals(@Query('limit') limit?: string) {
    return this.pendingApprovals.execute({ limit: limit ? Number(limit) : undefined });
  }

  @Post('scheduled-changes/process-due')
  @RequireEdgePermissions('platform:subscriptions:change_plan')
  processDueScheduledChanges() {
    return this.processDueChanges.execute({ actorId: this.actorId() });
  }

  @Get('trials')
  @RequireEdgePermissions('platform:subscriptions:manage_trials')
  trials(
    @Query('accountId') accountId?: string,
    @Query('subscriptionId') subscriptionId?: string,
    @Query('status') status?: string,
  ) {
    return this.listTrials.execute({ accountId, subscriptionId, status });
  }

  @Post('trials')
  @RequireEdgePermissions('platform:subscriptions:manage_trials')
  createTrial(
    @Body()
    body: {
      accountId: string;
      productId: string;
      subscriptionId?: string;
      durationDays?: number;
      packageId?: string;
    },
  ) {
    return this.startTrial.execute({ actorId: this.actorId(), ...body });
  }

  @Post('trials/:id/convert')
  @RequireEdgePermissions('platform:subscriptions:manage_trials')
  trialConvert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { subscriptionId: string },
  ) {
    return this.convertTrial.execute({
      actorId: this.actorId(),
      trialId: id,
      subscriptionId: body.subscriptionId,
    });
  }

  @Post('trials/:id/expire')
  @RequireEdgePermissions('platform:subscriptions:manage_trials')
  trialExpire(@Param('id', ParseUUIDPipe) id: string) {
    return this.expireTrial.execute(id);
  }

  @Get()
  @RequireEdgePermissions('platform:subscriptions:read')
  list(
    @Query('accountId') accountId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listSubs.execute({
      accountId,
      productId,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post()
  @RequireEdgePermissions('platform:subscriptions:create')
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body()
    body: {
      accountId: string;
      productId: string;
      contractId?: string;
      planId?: string;
      packageId?: string;
      currency?: string;
      billingFrequency?: string;
      correlationId?: string;
      enterpriseProfile?: Record<string, unknown>;
    },
  ) {
    return this.idempotency.execute({
      idempotencyKey,
      operation: 'subscription.create',
      resourceType: 'SUBSCRIPTION',
      run: async () => {
        const sub = await this.createSub.execute({ actorId: this.actorId(), ...body });
        return { resourceId: sub.id, body: sub as unknown as Record<string, unknown> };
      },
    });
  }

  @Post('from-handoff')
  @RequireEdgePermissions('platform:subscriptions:create')
  fromHandoff(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: { handoffId: string; acceptHandoff?: boolean },
  ) {
    return this.idempotency.execute({
      idempotencyKey,
      operation: 'subscription.from_handoff',
      resourceType: 'SUBSCRIPTION',
      run: async () => {
        const sub = await this.createFromHandoff.execute({
          actorId: this.actorId(),
          handoffId: body.handoffId,
          acceptHandoff: body.acceptHandoff,
        });
        return { resourceId: sub.id, body: sub as unknown as Record<string, unknown> };
      },
    });
  }

  @Get(':id')
  @RequireEdgePermissions('platform:subscriptions:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getSub.execute(id);
  }

  @Get(':id/workspace')
  @RequireEdgePermissions('platform:subscriptions:read')
  workspace(@Param('id', ParseUUIDPipe) id: string) {
    return this.getWorkspace.execute(id);
  }

  @Get(':id/history')
  @RequireEdgePermissions('platform:subscriptions:read')
  subscriptionHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.history.execute(id);
  }

  @Patch(':id')
  @RequireEdgePermissions('platform:subscriptions:update')
  patchSub(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      metadata?: Record<string, unknown>;
      enterpriseProfile?: Record<string, unknown>;
      billingFrequency?: string | null;
      currency?: string;
    },
  ) {
    return this.updateSub.execute({ actorId: this.actorId(), subscriptionId: id, ...body });
  }

  @Get(':id/suspensions')
  @RequireEdgePermissions('platform:subscriptions:read')
  suspensions(@Param('id', ParseUUIDPipe) id: string) {
    return this.listSuspensions.execute(id);
  }

  @Get(':id/cancellations')
  @RequireEdgePermissions('platform:subscriptions:read')
  cancellations(@Param('id', ParseUUIDPipe) id: string) {
    return this.listCancellations.execute(id);
  }

  @Get(':id/billing-coordination')
  @RequireEdgePermissions('platform:subscriptions:manage_integrations')
  billingCoordinationList(@Param('id', ParseUUIDPipe) id: string) {
    return this.coordination.execute(id).then((r) => r.billing);
  }

  @Get(':id/provisioning')
  @RequireEdgePermissions('platform:subscriptions:manage_integrations')
  provisioningList(@Param('id', ParseUUIDPipe) id: string) {
    return this.coordination.execute(id).then((r) => r.provisioning);
  }

  @Get(':id/publications')
  @RequireEdgePermissions('platform:subscriptions:read_entitlements')
  publications(@Param('id', ParseUUIDPipe) id: string) {
    return this.listPublications.execute(id);
  }

  @Post(':id/submit')
  @RequireEdgePermissions('platform:subscriptions:update')
  submitSub(@Param('id', ParseUUIDPipe) id: string) {
    return this.submit.execute({ actorId: this.actorId(), subscriptionId: id });
  }

  @Post(':id/approve')
  @RequireEdgePermissions('platform:subscriptions:approve')
  approveSub(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { requestedBy?: string },
  ) {
    return this.approve.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      requestedBy: body.requestedBy,
    });
  }

  @Post(':id/activate-request')
  @RequireEdgePermissions('platform:subscriptions:activate')
  activationRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestActivation.execute({ actorId: this.actorId(), subscriptionId: id });
  }

  @Post(':id/activate')
  @RequireEdgePermissions('platform:subscriptions:activate')
  activateSub(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.idempotency.execute({
      idempotencyKey,
      operation: 'subscription.activate',
      resourceType: 'SUBSCRIPTION',
      run: async () => {
        const sub = await this.activate.execute({ actorId: this.actorId(), subscriptionId: id });
        return { resourceId: sub.id, body: sub as unknown as Record<string, unknown> };
      },
    });
  }

  @Post(':id/suspend')
  @RequireEdgePermissions('platform:subscriptions:suspend')
  suspendSub(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: { reason: string },
  ) {
    return this.idempotency.execute({
      idempotencyKey,
      operation: 'subscription.suspend',
      resourceType: 'SUBSCRIPTION',
      run: async () => {
        const sub = await this.suspend.execute({
          actorId: this.actorId(),
          subscriptionId: id,
          reason: body.reason,
        });
        return { resourceId: sub.id, body: sub as unknown as Record<string, unknown> };
      },
    });
  }

  @Post(':id/reactivate')
  @RequireEdgePermissions('platform:subscriptions:reactivate')
  reactivateSub(@Param('id', ParseUUIDPipe) id: string) {
    return this.reactivate.execute({ actorId: this.actorId(), subscriptionId: id });
  }

  @Post(':id/cancel')
  @RequireEdgePermissions('platform:subscriptions:cancel')
  cancelSub(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string; noticeDays?: number },
  ) {
    return this.cancel.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      reason: body.reason,
      noticeDays: body.noticeDays,
    });
  }

  @Post(':id/terminate')
  @RequireEdgePermissions('platform:subscriptions:terminate')
  terminateSub(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.terminate.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      reason: body.reason,
    });
  }

  @Get(':id/items')
  @RequireEdgePermissions('platform:subscriptions:read')
  items(@Param('id', ParseUUIDPipe) id: string) {
    return this.listItems.execute(id);
  }

  @Post(':id/items')
  @RequireEdgePermissions('platform:subscriptions:manage_addons')
  addSubscriptionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      itemType: string;
      productId?: string;
      offerRef?: string;
      quantity?: number;
      snapshot?: Record<string, unknown>;
      available?: boolean;
      eligible?: boolean;
    },
  ) {
    return this.addItem.execute({ actorId: this.actorId(), subscriptionId: id, ...body });
  }

  @Post(':id/entitlements/calculate')
  @RequireEdgePermissions('platform:subscriptions:read_entitlements')
  calcEntitlements(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.calculateEntitlements.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      reason: body.reason,
    });
  }

  @Get(':id/entitlements')
  @RequireEdgePermissions('platform:subscriptions:read_entitlements')
  entitlements(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEntitlements.execute(id);
  }

  @Post(':id/entitlements/publish')
  @RequireEdgePermissions('platform:subscriptions:publish_entitlements')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { snapshotId?: string },
  ) {
    return this.publishEntitlements.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      snapshotId: body.snapshotId,
    });
  }

  @Post(':id/entitlements/reconcile')
  @RequireEdgePermissions('platform:subscriptions:reconcile_entitlements')
  reconcile(@Param('id', ParseUUIDPipe) id: string) {
    return this.reconcileEntitlements.execute({ actorId: this.actorId(), subscriptionId: id });
  }

  @Get(':id/changes')
  @RequireEdgePermissions('platform:subscriptions:change_plan')
  changes(@Param('id', ParseUUIDPipe) id: string) {
    return this.listChanges.execute(id);
  }

  @Post(':id/changes')
  @RequireEdgePermissions('platform:subscriptions:change_plan')
  newChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      changeType: string;
      proposedConfig?: Record<string, unknown>;
      reason?: string;
    },
  ) {
    return this.createChange.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      ...body,
    });
  }

  @Post(':id/changes/:changeId/approve')
  @RequireEdgePermissions('platform:subscriptions:approve')
  approveChangeReq(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @Body() body: { decisionNote?: string },
  ) {
    return this.approveChange.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      changeId,
      decisionNote: body.decisionNote,
    });
  }

  @Post(':id/changes/:changeId/reject')
  @RequireEdgePermissions('platform:subscriptions:approve')
  rejectChangeReq(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @Body() body: { decisionNote?: string },
  ) {
    return this.rejectChange.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      changeId,
      decisionNote: body.decisionNote,
    });
  }

  @Post(':id/changes/:changeId/schedule')
  @RequireEdgePermissions('platform:subscriptions:change_plan')
  scheduleChangeReq(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @Body() body: { executeAt: string },
  ) {
    return this.scheduleChange.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      changeId,
      executeAt: body.executeAt,
    });
  }

  @Post(':id/changes/:changeId/execute')
  @RequireEdgePermissions('platform:subscriptions:change_plan')
  runChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
  ) {
    return this.executeChange.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      changeId,
    });
  }

  @Post(':id/renewals')
  @RequireEdgePermissions('platform:subscriptions:renew')
  createRenewal(@Param('id', ParseUUIDPipe) id: string, @Body() body: { dueAt?: string }) {
    return this.proposeRenewal.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      dueAt: body.dueAt,
    });
  }

  @Post(':id/renewals/confirm')
  @RequireEdgePermissions('platform:subscriptions:renew')
  confirmRenewal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { renewalId?: string },
  ) {
    return this.renew.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      renewalId: body.renewalId,
    });
  }

  @Get(':id/renewals')
  @RequireEdgePermissions('platform:subscriptions:renew')
  renewals(@Param('id', ParseUUIDPipe) id: string) {
    return this.listRenewals.execute(id);
  }

  @Post(':id/billing-coordination')
  @RequireEdgePermissions('platform:subscriptions:manage_integrations')
  billingCoordination(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { billingAccountRef?: string },
  ) {
    return this.requestBilling.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      billingAccountRef: body.billingAccountRef,
    });
  }

  @Post(':id/billing-coordination/:coordId/confirm')
  @RequireEdgePermissions('platform:subscriptions:manage_integrations')
  confirmBillingCoordination(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('coordId', ParseUUIDPipe) coordId: string,
    @Body() body: { externalRef?: string },
  ) {
    return this.confirmBilling.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      coordinationId: coordId,
      externalRef: body.externalRef,
    });
  }

  @Post(':id/provisioning')
  @RequireEdgePermissions('platform:subscriptions:manage_integrations')
  provisioning(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestProvisioning.execute({
      actorId: this.actorId(),
      subscriptionId: id,
    });
  }

  @Post(':id/provisioning/:reqId/complete')
  @RequireEdgePermissions('platform:subscriptions:manage_integrations')
  completeProvisioning(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reqId', ParseUUIDPipe) reqId: string,
    @Body() body: { tenantRef?: string; externalRef?: string },
  ) {
    return this.completeProvisioningUseCase.execute({
      actorId: this.actorId(),
      subscriptionId: id,
      requestId: reqId,
      tenantRef: body.tenantRef,
      externalRef: body.externalRef,
    });
  }
}
