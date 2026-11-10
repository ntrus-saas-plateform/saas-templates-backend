import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  AcceptSalesLeadUseCase,
  AddSalesTeamMemberUseCase,
  AssignSalesLeadUseCase,
  CompleteSalesTaskUseCase,
  CreateCommercialAccountUseCase,
  CreateSalesContactUseCase,
  CreateSalesNoteUseCase,
  CreateSalesTaskUseCase,
  CreateSalesTeamUseCase,
  CreateSalesTerritoryUseCase,
  FindDuplicateAccountsUseCase,
  GetCommercialAccountUseCase,
  GetSalesContactUseCase,
  GetSalesLeadUseCase,
  ListAccountTimelineUseCase,
  ListCommercialAccountsUseCase,
  ListSalesContactsUseCase,
  ListSalesLeadsUseCase,
  ListSalesTasksUseCase,
  ListSalesTeamsUseCase,
  ListSalesTerritoriesUseCase,
  MergeCommercialAccountsUseCase,
  QualifySalesLeadUseCase,
  ReceiveSalesLeadUseCase,
  RejectSalesLeadUseCase,
  SalesOverviewUseCase,
  UpdateCommercialAccountUseCase,
} from '../../application/sales/sales.use-cases.js';
import {
  AddOpportunityCompetitorUseCase,
  AddOpportunityContactUseCase,
  AddOpportunityRiskUseCase,
  CreateOpportunityUseCase,
  GetOpportunityUseCase,
  GetSalesPipelineBoardUseCase,
  ListOpportunitiesUseCase,
  ListSalesPipelinesUseCase,
  ReopenOpportunityUseCase,
  TransitionOpportunityStageUseCase,
  UpdateOpportunityUseCase,
} from '../../application/sales/sales-opportunity.use-cases.js';
import {
  AcceptSalesHandoffUseCase,
  CompleteNeedsAssessmentUseCase,
  CompleteSalesActivityUseCase,
  CreateNeedsAssessmentUseCase,
  CreateOpportunityOfferConfigurationUseCase,
  CreateSalesActivityUseCase,
  CreateSalesContractUseCase,
  CreateSalesOrderUseCase,
  CreateSalesProposalUseCase,
  CreateSalesQuoteUseCase,
  DecideSalesApprovalUseCase,
  DecideSalesDiscountUseCase,
  GetSalesForecastUseCase,
  GetSalesPerformanceUseCase,
  GetSalesQuoteUseCase,
  IssueSalesProposalUseCase,
  ListNeedsAssessmentsUseCase,
  ListOfferConfigurationsUseCase,
  ListSalesActivitiesUseCase,
  ListSalesApprovalsUseCase,
  ListSalesContractsUseCase,
  ListSalesDiscountRequestsUseCase,
  ListSalesHandoffsUseCase,
  ListSalesOrdersUseCase,
  ListSalesProposalsUseCase,
  ListSalesQuotesUseCase,
  ReceiveProvisioningStatusUseCase,
  RequestSalesDiscountUseCase,
  RequestSalesHandoffUseCase,
  ReviseSalesQuoteUseCase,
  TransitionSalesContractUseCase,
  TransitionSalesOrderUseCase,
  TransitionSalesQuoteUseCase,
} from '../../application/sales/sales-commerce.use-cases.js';

@ApiTags('edge-sales')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/sales')
export class EdgeSalesController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly overview: SalesOverviewUseCase,
    private readonly createTeam: CreateSalesTeamUseCase,
    private readonly listTeams: ListSalesTeamsUseCase,
    private readonly addTeamMember: AddSalesTeamMemberUseCase,
    private readonly createTerritory: CreateSalesTerritoryUseCase,
    private readonly listTerritories: ListSalesTerritoriesUseCase,
    private readonly createAccount: CreateCommercialAccountUseCase,
    private readonly listAccounts: ListCommercialAccountsUseCase,
    private readonly getAccount: GetCommercialAccountUseCase,
    private readonly updateAccount: UpdateCommercialAccountUseCase,
    private readonly findDuplicates: FindDuplicateAccountsUseCase,
    private readonly mergeAccounts: MergeCommercialAccountsUseCase,
    private readonly createContact: CreateSalesContactUseCase,
    private readonly listContacts: ListSalesContactsUseCase,
    private readonly getContact: GetSalesContactUseCase,
    private readonly receiveLead: ReceiveSalesLeadUseCase,
    private readonly listLeads: ListSalesLeadsUseCase,
    private readonly getLead: GetSalesLeadUseCase,
    private readonly acceptLead: AcceptSalesLeadUseCase,
    private readonly rejectLead: RejectSalesLeadUseCase,
    private readonly qualifyLead: QualifySalesLeadUseCase,
    private readonly assignLead: AssignSalesLeadUseCase,
    private readonly listTimeline: ListAccountTimelineUseCase,
    private readonly createNote: CreateSalesNoteUseCase,
    private readonly createTask: CreateSalesTaskUseCase,
    private readonly listTasks: ListSalesTasksUseCase,
    private readonly completeTask: CompleteSalesTaskUseCase,
    private readonly listPipelines: ListSalesPipelinesUseCase,
    private readonly pipelineBoard: GetSalesPipelineBoardUseCase,
    private readonly createOpportunity: CreateOpportunityUseCase,
    private readonly listOpportunities: ListOpportunitiesUseCase,
    private readonly getOpportunity: GetOpportunityUseCase,
    private readonly updateOpportunity: UpdateOpportunityUseCase,
    private readonly transitionOpportunity: TransitionOpportunityStageUseCase,
    private readonly reopenOpportunity: ReopenOpportunityUseCase,
    private readonly addOppRisk: AddOpportunityRiskUseCase,
    private readonly addOppCompetitor: AddOpportunityCompetitorUseCase,
    private readonly addOppContact: AddOpportunityContactUseCase,
    private readonly createActivity: CreateSalesActivityUseCase,
    private readonly listActivities: ListSalesActivitiesUseCase,
    private readonly completeActivity: CompleteSalesActivityUseCase,
    private readonly createAssessment: CreateNeedsAssessmentUseCase,
    private readonly completeAssessment: CompleteNeedsAssessmentUseCase,
    private readonly listAssessments: ListNeedsAssessmentsUseCase,
    private readonly createOfferCfg: CreateOpportunityOfferConfigurationUseCase,
    private readonly listOfferCfgs: ListOfferConfigurationsUseCase,
    private readonly createQuote: CreateSalesQuoteUseCase,
    private readonly listQuotes: ListSalesQuotesUseCase,
    private readonly getQuote: GetSalesQuoteUseCase,
    private readonly transitionQuote: TransitionSalesQuoteUseCase,
    private readonly reviseQuote: ReviseSalesQuoteUseCase,
    private readonly createProposal: CreateSalesProposalUseCase,
    private readonly listProposals: ListSalesProposalsUseCase,
    private readonly issueProposal: IssueSalesProposalUseCase,
    private readonly requestDiscount: RequestSalesDiscountUseCase,
    private readonly decideDiscount: DecideSalesDiscountUseCase,
    private readonly listDiscounts: ListSalesDiscountRequestsUseCase,
    private readonly listApprovals: ListSalesApprovalsUseCase,
    private readonly decideApproval: DecideSalesApprovalUseCase,
    private readonly createContract: CreateSalesContractUseCase,
    private readonly listContracts: ListSalesContractsUseCase,
    private readonly transitionContract: TransitionSalesContractUseCase,
    private readonly createOrder: CreateSalesOrderUseCase,
    private readonly listOrders: ListSalesOrdersUseCase,
    private readonly transitionOrder: TransitionSalesOrderUseCase,
    private readonly requestHandoff: RequestSalesHandoffUseCase,
    private readonly acceptHandoff: AcceptSalesHandoffUseCase,
    private readonly receiveProvisioning: ReceiveProvisioningStatusUseCase,
    private readonly listHandoffs: ListSalesHandoffsUseCase,
    private readonly getForecast: GetSalesForecastUseCase,
    private readonly getPerformance: GetSalesPerformanceUseCase,
  ) {}

  private actorId(): string {
    return this.edgeContext.getOrThrow().administratorId!;
  }

  @Get('overview')
  @RequireEdgePermissions('platform:sales:analytics:read')
  getOverview() {
    return this.overview.execute();
  }

  @Get('teams')
  @RequireEdgePermissions('platform:sales:teams:read')
  getTeams() {
    return this.listTeams.execute();
  }

  @Post('teams')
  @RequireEdgePermissions('platform:sales:teams:manage')
  postTeam(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      managerAdministratorId?: string | null;
    },
  ) {
    return this.createTeam.execute({ actorId: this.actorId(), ...body });
  }

  @Post('teams/:id/members')
  @RequireEdgePermissions('platform:sales:teams:manage')
  postTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      administratorId: string;
      memberRole?: string;
      territoryId?: string | null;
    },
  ) {
    return this.addTeamMember.execute({ teamId: id, ...body });
  }

  @Get('territories')
  @RequireEdgePermissions('platform:sales:teams:read')
  getTerritories() {
    return this.listTerritories.execute();
  }

  @Post('territories')
  @RequireEdgePermissions('platform:sales:teams:manage')
  postTerritory(
    @Body()
    body: {
      code: string;
      name: string;
      territoryType?: string;
      country?: string | null;
      region?: string | null;
      productId?: string | null;
      verticalId?: string | null;
      marketId?: string | null;
    },
  ) {
    return this.createTerritory.execute(body);
  }

  @Get('accounts')
  @RequireEdgePermissions('platform:sales:accounts:read')
  getAccounts(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('ownerAdministratorId') ownerAdministratorId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listAccounts.execute({
      status,
      q,
      ownerAdministratorId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('accounts')
  @RequireEdgePermissions('platform:sales:accounts:create')
  postAccount(
    @Body()
    body: {
      legalName: string;
      tradeName?: string | null;
      accountType?: string;
      country?: string | null;
      region?: string | null;
      city?: string | null;
      addressLine1?: string | null;
      industry?: string | null;
      companySize?: string | null;
      website?: string | null;
      legalIdentifier?: string | null;
      legalIdentifierType?: string | null;
      emailDomain?: string | null;
      phoneNormalized?: string | null;
      parentAccountId?: string | null;
      ownerAdministratorId?: string | null;
      teamId?: string | null;
      primaryProductId?: string | null;
      verticalId?: string | null;
      billingInfo?: Record<string, unknown>;
      forceCreateDespiteDuplicates?: boolean;
    },
  ) {
    return this.createAccount.execute({ actorId: this.actorId(), ...body });
  }

  @Get('accounts/:id')
  @RequireEdgePermissions('platform:sales:accounts:read')
  getAccountById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getAccount.execute(id);
  }

  @Put('accounts/:id')
  @RequireEdgePermissions('platform:sales:accounts:update')
  putAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      legalName?: string;
      tradeName?: string | null;
      accountType?: string;
      status?: string;
      country?: string | null;
      region?: string | null;
      city?: string | null;
      addressLine1?: string | null;
      industry?: string | null;
      companySize?: string | null;
      website?: string | null;
      legalIdentifier?: string | null;
      legalIdentifierType?: string | null;
      emailDomain?: string | null;
      phoneNormalized?: string | null;
      parentAccountId?: string | null;
      ownerAdministratorId?: string | null;
      teamId?: string | null;
      primaryProductId?: string | null;
      verticalId?: string | null;
    },
  ) {
    return this.updateAccount.execute({ actorId: this.actorId(), id, ...body });
  }

  @Post('accounts/duplicates')
  @RequireEdgePermissions('platform:sales:accounts:read')
  postDuplicates(
    @Body()
    body: {
      legalName: string;
      legalIdentifier?: string | null;
      emailDomain?: string | null;
      phoneNormalized?: string | null;
      country?: string | null;
      excludeAccountId?: string | null;
    },
  ) {
    return this.findDuplicates.execute(body);
  }

  @Post('accounts/merge')
  @RequireEdgePermissions('platform:sales:accounts:merge')
  postMerge(
    @Body()
    body: {
      survivingAccountId: string;
      mergedAccountId: string;
      reason: string;
    },
  ) {
    return this.mergeAccounts.execute({ actorId: this.actorId(), ...body });
  }

  @Get('accounts/:id/timeline')
  @RequireEdgePermissions('platform:sales:accounts:read')
  getTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.listTimeline.execute(id, limit ? Number(limit) : undefined);
  }

  @Get('contacts')
  @RequireEdgePermissions('platform:sales:contacts:read')
  getContacts(
    @Query('accountId') accountId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listContacts.execute({
      accountId,
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('contacts')
  @RequireEdgePermissions('platform:sales:contacts:manage')
  postContact(
    @Body()
    body: {
      accountId: string;
      firstName: string;
      lastName: string;
      email?: string | null;
      phoneNormalized?: string | null;
      jobTitle?: string | null;
      department?: string | null;
      stakeholderType?: string;
      influenceLevel?: string;
      communicationPreference?: string | null;
      ownerAdministratorId?: string | null;
      marketingLeadId?: string | null;
    },
  ) {
    return this.createContact.execute({ actorId: this.actorId(), ...body });
  }

  @Get('contacts/:id')
  @RequireEdgePermissions('platform:sales:contacts:read')
  getContactById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getContact.execute(id);
  }

  @Get('leads')
  @RequireEdgePermissions('platform:sales:leads:read')
  getLeads(
    @Query('status') status?: string,
    @Query('ownerAdministratorId') ownerAdministratorId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listLeads.execute({
      status,
      ownerAdministratorId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('leads/receive')
  @RequireEdgePermissions('platform:sales:leads:accept')
  postReceiveLead(
    @Body()
    body: {
      marketingLeadId: string;
      ownerAdministratorId?: string | null;
      teamId?: string | null;
      salesPriority?: string;
      slaHours?: number;
    },
  ) {
    return this.receiveLead.execute({ actorId: this.actorId(), ...body });
  }

  @Get('leads/:id')
  @RequireEdgePermissions('platform:sales:leads:read')
  getLeadById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getLead.execute(id);
  }

  @Post('leads/:id/acceptance')
  @RequireEdgePermissions('platform:sales:leads:accept')
  postAcceptLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      accountId?: string | null;
      createAccount?: {
        legalName: string;
        country?: string | null;
        emailDomain?: string | null;
        industry?: string | null;
      };
      contact?: {
        firstName: string;
        lastName: string;
        email?: string | null;
        jobTitle?: string | null;
      };
    },
  ) {
    return this.acceptLead.execute({
      actorId: this.actorId(),
      salesLeadId: id,
      ...body,
    });
  }

  @Post('leads/:id/rejection')
  @RequireEdgePermissions('platform:sales:leads:reject')
  postRejectLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { reasonCode?: string | null; reasonText?: string | null },
  ) {
    return this.rejectLead.execute({
      actorId: this.actorId(),
      salesLeadId: id,
      ...body,
    });
  }

  @Post('leads/:id/qualification')
  @RequireEdgePermissions('platform:sales:leads:qualify')
  postQualifyLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      needConfirmed: boolean;
      productFit: boolean;
      decisionCapacity: boolean;
      budgetIndicative?: string | null;
      decisionTimeline?: string | null;
      projectMaturity?: string | null;
      technicalConstraints?: string | null;
      geographicScope?: string | null;
    },
  ) {
    return this.qualifyLead.execute({
      actorId: this.actorId(),
      salesLeadId: id,
      ...body,
    });
  }

  @Post('leads/:id/assignment')
  @RequireEdgePermissions('platform:sales:leads:assign')
  postAssignLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { ownerAdministratorId: string; teamId?: string | null },
  ) {
    return this.assignLead.execute({
      actorId: this.actorId(),
      salesLeadId: id,
      ...body,
    });
  }

  @Post('notes')
  @RequireEdgePermissions('platform:sales:activities:manage')
  postNote(
    @Body()
    body: {
      accountId?: string | null;
      contactId?: string | null;
      salesLeadId?: string | null;
      body: string;
      visibility?: string;
    },
  ) {
    return this.createNote.execute({ actorId: this.actorId(), ...body });
  }

  @Get('tasks')
  @RequireEdgePermissions('platform:sales:activities:manage')
  getTasks(
    @Query('accountId') accountId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
  ) {
    return this.listTasks.execute({ accountId, assigneeId, status });
  }

  @Post('tasks')
  @RequireEdgePermissions('platform:sales:activities:manage')
  postTask(
    @Body()
    body: {
      accountId?: string | null;
      contactId?: string | null;
      salesLeadId?: string | null;
      title: string;
      description?: string | null;
      priority?: string;
      dueAt?: string | null;
      assigneeId?: string | null;
    },
  ) {
    return this.createTask.execute({ actorId: this.actorId(), ...body });
  }

  @Post('tasks/:id/complete')
  @RequireEdgePermissions('platform:sales:activities:manage')
  postCompleteTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.completeTask.execute(id);
  }

  @Get('pipelines')
  @RequireEdgePermissions('platform:sales:opportunities:read')
  getPipelines() {
    return this.listPipelines.execute();
  }

  @Get('pipeline/board')
  @RequireEdgePermissions('platform:sales:opportunities:read')
  getPipelineBoard(@Query('pipelineId') pipelineId?: string) {
    return this.pipelineBoard.execute(pipelineId);
  }

  @Get('opportunities')
  @RequireEdgePermissions('platform:sales:opportunities:read')
  getOpportunities(
    @Query('status') status?: string,
    @Query('accountId') accountId?: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('stageId') stageId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listOpportunities.execute({
      status,
      accountId,
      pipelineId,
      stageId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('opportunities')
  @RequireEdgePermissions('platform:sales:opportunities:create')
  postOpportunity(
    @Body()
    body: {
      name: string;
      accountId: string;
      salesLeadId?: string | null;
      pipelineId?: string | null;
      ownerAdministratorId?: string | null;
      teamId?: string | null;
      productId?: string | null;
      verticalId?: string | null;
      needSummary?: string | null;
      scopeSummary?: string | null;
      estimatedValue?: number | null;
      currency?: string;
      expectedCloseDate?: string | null;
      source?: string | null;
    },
  ) {
    return this.createOpportunity.execute({
      actorId: this.actorId(),
      ...body,
    });
  }

  @Get('opportunities/:id')
  @RequireEdgePermissions('platform:sales:opportunities:read')
  getOpportunityById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOpportunity.execute(id);
  }

  @Put('opportunities/:id')
  @RequireEdgePermissions('platform:sales:opportunities:update')
  putOpportunity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      ownerAdministratorId?: string | null;
      teamId?: string | null;
      productId?: string | null;
      verticalId?: string | null;
      needSummary?: string | null;
      scopeSummary?: string | null;
      estimatedValue?: number | null;
      currency?: string;
      probability?: number | null;
      expectedCloseDate?: string | null;
      forecastCategory?: string;
    },
  ) {
    return this.updateOpportunity.execute({
      actorId: this.actorId(),
      id,
      ...body,
    });
  }

  @Post('opportunities/:id/stages')
  @RequireEdgePermissions('platform:sales:opportunities:update')
  postOpportunityStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      toStageId: string;
      reasonCode?: string | null;
      reasonText?: string | null;
      requireQuote?: boolean;
      requireContract?: boolean;
    },
  ) {
    return this.transitionOpportunity.execute({
      actorId: this.actorId(),
      opportunityId: id,
      toStageId: body.toStageId,
      reasonCode: body.reasonCode,
      reasonText: body.reasonText,
      requireQuote: body.requireQuote,
      requireContract: body.requireContract,
    });
  }

  @Post('opportunities/:id/close')
  @RequireEdgePermissions('platform:sales:opportunities:close')
  postOpportunityClose(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      toStageId: string;
      reasonCode?: string | null;
      reasonText?: string | null;
      requireQuote?: boolean;
      requireContract?: boolean;
    },
  ) {
    return this.transitionOpportunity.execute({
      actorId: this.actorId(),
      opportunityId: id,
      toStageId: body.toStageId,
      reasonCode: body.reasonCode,
      reasonText: body.reasonText,
      requireQuote: body.requireQuote,
      requireContract: body.requireContract,
    });
  }

  @Post('opportunities/:id/reopen')
  @RequireEdgePermissions('platform:sales:opportunities:update')
  postOpportunityReopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ) {
    return this.reopenOpportunity.execute({
      actorId: this.actorId(),
      opportunityId: id,
      reason: body.reason,
    });
  }

  @Post('opportunities/:id/risks')
  @RequireEdgePermissions('platform:sales:opportunities:update')
  postOpportunityRisk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      code: string;
      title: string;
      severity?: string;
      description?: string | null;
    },
  ) {
    return this.addOppRisk.execute({ opportunityId: id, ...body });
  }

  @Post('opportunities/:id/competitors')
  @RequireEdgePermissions('platform:sales:opportunities:update')
  postOpportunityCompetitor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      competitorName: string;
      threatLevel?: string;
      notes?: string | null;
    },
  ) {
    return this.addOppCompetitor.execute({ opportunityId: id, ...body });
  }

  @Post('opportunities/:id/contacts')
  @RequireEdgePermissions('platform:sales:opportunities:update')
  postOpportunityContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      contactId: string;
      roleOnOpportunity?: string;
      isPrimary?: boolean;
    },
  ) {
    return this.addOppContact.execute({ opportunityId: id, ...body });
  }

  // --- P4.4 Activities & Needs ---

  @Get('activities')
  @RequireEdgePermissions('platform:sales:activities:manage')
  getActivities(
    @Query('accountId') accountId?: string,
    @Query('opportunityId') opportunityId?: string,
    @Query('status') status?: string,
  ) {
    return this.listActivities.execute({ accountId, opportunityId, status });
  }

  @Post('activities')
  @RequireEdgePermissions('platform:sales:activities:manage')
  postActivity(
    @Body()
    body: {
      activityType: string;
      subject: string;
      description?: string | null;
      accountId?: string | null;
      contactId?: string | null;
      salesLeadId?: string | null;
      opportunityId?: string | null;
      scheduledStartAt?: string | null;
      scheduledEndAt?: string | null;
    },
  ) {
    return this.createActivity.execute({ actorId: this.actorId(), ...body });
  }

  @Post('activities/:id/complete')
  @RequireEdgePermissions('platform:sales:activities:manage')
  postCompleteActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { outcomeSummary?: string | null },
  ) {
    return this.completeActivity.execute(id, body.outcomeSummary);
  }

  @Get('opportunities/:id/assessments')
  @RequireEdgePermissions('platform:sales:assessments:manage')
  getAssessments(@Param('id', ParseUUIDPipe) id: string) {
    return this.listAssessments.execute(id);
  }

  @Post('opportunities/:id/assessments')
  @RequireEdgePermissions('platform:sales:assessments:manage')
  postAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      templateCode?: string | null;
      currentSituation?: string | null;
      objectives?: string | null;
      functionalRequirements?: unknown[];
      technicalRequirements?: unknown[];
    },
  ) {
    return this.createAssessment.execute({
      actorId: this.actorId(),
      opportunityId: id,
      ...body,
    });
  }

  @Post('assessments/:id/complete')
  @RequireEdgePermissions('platform:sales:assessments:manage')
  postCompleteAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      fitDecision: string;
      uncoveredNeeds?: unknown[];
      gapAnalysis?: unknown[];
      recommendations?: string | null;
      promisedCapabilities?: string[];
      commerciallyAuthorizedCapabilities?: string[];
    },
  ) {
    return this.completeAssessment.execute({
      actorId: this.actorId(),
      assessmentId: id,
      ...body,
    });
  }

  // --- P4.5–P4.6 Offers / Quotes / Proposals ---

  @Get('opportunities/:id/offers')
  @RequireEdgePermissions('platform:sales:quotes:read')
  getOffers(@Param('id', ParseUUIDPipe) id: string) {
    return this.listOfferCfgs.execute(id);
  }

  @Post('opportunities/:id/offers')
  @RequireEdgePermissions('platform:sales:quotes:create')
  postOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      productId: string;
      productLifecycleStatus: string;
      planId: string;
      planProductId: string;
      planStatus: string;
      packageId?: string | null;
      packageProductId?: string | null;
      addonIds?: string[];
      addonProductIds?: string[];
      currency?: string;
      listAmount?: number | null;
      netAmount?: number | null;
      geographicScope?: string | null;
      deploymentMode?: string | null;
      rulesVersion?: number;
    },
  ) {
    return this.createOfferCfg.execute({
      actorId: this.actorId(),
      opportunityId: id,
      ...body,
    });
  }

  @Get('quotes')
  @RequireEdgePermissions('platform:sales:quotes:read')
  getQuotes(
    @Query('opportunityId') opportunityId?: string,
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
  ) {
    return this.listQuotes.execute({ opportunityId, accountId, status });
  }

  @Post('quotes')
  @RequireEdgePermissions('platform:sales:quotes:create')
  postQuote(
    @Body()
    body: {
      opportunityId: string;
      contactId?: string | null;
      offerConfigurationId?: string | null;
      currency?: string;
      validUntil?: string | null;
      lines: Array<{
        lineNumber: number;
        lineType?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent?: number;
        productId?: string | null;
        planId?: string | null;
        packageId?: string | null;
        addonId?: string | null;
        pricingModel?: string | null;
        p2Refs?: Record<string, unknown>;
      }>;
    },
  ) {
    return this.createQuote.execute({ actorId: this.actorId(), ...body });
  }

  @Get('quotes/:id')
  @RequireEdgePermissions('platform:sales:quotes:read')
  getQuoteById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getQuote.execute(id);
  }

  @Post('quotes/:id/transition')
  @RequireEdgePermissions('platform:sales:quotes:approve')
  postQuoteTransition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { toStatus: string; approvalRequired?: boolean },
  ) {
    return this.transitionQuote.execute({
      actorId: this.actorId(),
      quoteId: id,
      ...body,
    });
  }

  @Post('quotes/:id/revisions')
  @RequireEdgePermissions('platform:sales:quotes:create')
  postQuoteRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      changeReason: string;
      lines: Array<{
        lineNumber: number;
        lineType?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent?: number;
        productId?: string | null;
        planId?: string | null;
        packageId?: string | null;
        addonId?: string | null;
        pricingModel?: string | null;
        p2Refs?: Record<string, unknown>;
      }>;
    },
  ) {
    return this.reviseQuote.execute({
      actorId: this.actorId(),
      quoteId: id,
      ...body,
    });
  }

  @Get('proposals')
  @RequireEdgePermissions('platform:sales:proposals:manage')
  getProposals(@Query('opportunityId') opportunityId?: string) {
    return this.listProposals.execute(opportunityId);
  }

  @Post('proposals')
  @RequireEdgePermissions('platform:sales:proposals:manage')
  postProposal(
    @Body()
    body: {
      opportunityId: string;
      quoteId?: string | null;
      title: string;
      language?: string;
      templateCode?: string | null;
      sections?: unknown[];
    },
  ) {
    return this.createProposal.execute({ actorId: this.actorId(), ...body });
  }

  @Post('proposals/:id/issue')
  @RequireEdgePermissions('platform:sales:proposals:manage')
  postIssueProposal(@Param('id', ParseUUIDPipe) id: string) {
    return this.issueProposal.execute({
      actorId: this.actorId(),
      proposalId: id,
    });
  }

  // --- P4.7 Deal desk ---

  @Get('discount-requests')
  @RequireEdgePermissions('platform:sales:discounts:request')
  getDiscountRequests(
    @Query('status') status?: string,
    @Query('opportunityId') opportunityId?: string,
  ) {
    return this.listDiscounts.execute({ status, opportunityId });
  }

  @Post('discount-requests')
  @RequireEdgePermissions('platform:sales:discounts:request')
  postDiscountRequest(
    @Body()
    body: {
      opportunityId: string;
      quoteId?: string | null;
      listAmount: number;
      requestedAmount: number;
      justification: string;
      discountType?: string;
      policyCode?: string;
    },
  ) {
    return this.requestDiscount.execute({ actorId: this.actorId(), ...body });
  }

  @Post('discount-requests/:id/decision')
  @RequireEdgePermissions('platform:sales:discounts:approve')
  postDiscountDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { decision: 'APPROVED' | 'REJECTED'; decisionNotes?: string | null },
  ) {
    return this.decideDiscount.execute({
      actorId: this.actorId(),
      requestId: id,
      ...body,
    });
  }

  @Get('approvals')
  @RequireEdgePermissions('platform:sales:governance:manage')
  getApprovals(
    @Query('status') status?: string,
    @Query('subjectType') subjectType?: string,
  ) {
    return this.listApprovals.execute({ status, subjectType });
  }

  @Post('approvals/:id/decision')
  @RequireEdgePermissions('platform:sales:governance:manage')
  postApprovalDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
      decisionNotes?: string | null;
    },
  ) {
    return this.decideApproval.execute({
      actorId: this.actorId(),
      approvalId: id,
      ...body,
    });
  }

  // --- P4.8–P4.9 Contracts / Orders / Handoff ---

  @Get('contracts')
  @RequireEdgePermissions('platform:sales:contracts:read')
  getContracts(
    @Query('accountId') accountId?: string,
    @Query('opportunityId') opportunityId?: string,
    @Query('status') status?: string,
  ) {
    return this.listContracts.execute({ accountId, opportunityId, status });
  }

  @Post('contracts')
  @RequireEdgePermissions('platform:sales:contracts:manage')
  postContract(
    @Body()
    body: {
      opportunityId: string;
      quoteId?: string | null;
      contractType?: string;
      contractValue?: number | null;
      commercialTermsSnapshot?: Record<string, unknown>;
      parties?: unknown[];
      signers?: unknown[];
    },
  ) {
    return this.createContract.execute({ actorId: this.actorId(), ...body });
  }

  @Post('contracts/:id/transition')
  @RequireEdgePermissions('platform:sales:contracts:approve')
  postContractTransition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      toStatus: string;
      signatureProviderConfirmed?: boolean;
      signatureProvider?: string | null;
      signatureExternalId?: string | null;
      providerEventId?: string | null;
    },
  ) {
    return this.transitionContract.execute({
      actorId: this.actorId(),
      contractId: id,
      ...body,
    });
  }

  @Get('orders')
  @RequireEdgePermissions('platform:sales:orders:manage')
  getOrders(
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
  ) {
    return this.listOrders.execute({ accountId, status });
  }

  @Post('orders')
  @RequireEdgePermissions('platform:sales:orders:manage')
  postOrder(
    @Body()
    body: {
      opportunityId?: string | null;
      contractId?: string | null;
      quoteId?: string | null;
      requestedGoLiveDate?: string | null;
    },
  ) {
    return this.createOrder.execute({ actorId: this.actorId(), ...body });
  }

  @Post('orders/:id/transition')
  @RequireEdgePermissions('platform:sales:orders:manage')
  postOrderTransition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { toStatus: string },
  ) {
    return this.transitionOrder.execute({
      actorId: this.actorId(),
      orderId: id,
      toStatus: body.toStatus,
    });
  }

  @Get('handoffs')
  @RequireEdgePermissions('platform:sales:handoff:execute')
  getHandoffs(@Query('status') status?: string) {
    return this.listHandoffs.execute({ status });
  }

  @Post('orders/:id/handoff')
  @RequireEdgePermissions('platform:sales:handoff:execute')
  postHandoff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      correlationId?: string;
      requireContract?: boolean;
      requireQuote?: boolean;
      idempotencyKey?: string;
    },
  ) {
    return this.requestHandoff.execute({
      actorId: this.actorId(),
      salesOrderId: id,
      ...body,
    });
  }

  @Post('handoffs/:id/accept')
  @RequireEdgePermissions('platform:sales:handoff:execute')
  postAcceptHandoff(@Param('id', ParseUUIDPipe) id: string) {
    return this.acceptHandoff.execute({
      actorId: this.actorId(),
      handoffId: id,
    });
  }

  @Post('handoffs/:id/provisioning-status')
  @RequireEdgePermissions('platform:sales:handoff:execute')
  postProvisioningStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      confirmed: boolean;
      externalSystem?: string;
      externalRef?: string | null;
      productId?: string | null;
      claimFulfilled?: boolean;
    },
  ) {
    return this.receiveProvisioning.execute({
      actorId: this.actorId(),
      handoffId: id,
      ...body,
    });
  }

  // --- P4.10 Forecast / Performance ---

  @Get('forecast')
  @RequireEdgePermissions('platform:sales:forecast:read')
  getForecastApi(
    @Query('model') model?: 'PIPELINE' | 'WEIGHTED' | 'BEST_CASE' | 'COMMIT' | 'MOST_LIKELY',
    @Query('ownerAdministratorId') ownerAdministratorId?: string,
    @Query('teamId') teamId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.getForecast.execute({
      model,
      ownerAdministratorId,
      teamId,
      productId,
    });
  }

  @Get('analytics/performance')
  @RequireEdgePermissions('platform:sales:analytics:read')
  getPerformanceApi() {
    return this.getPerformance.execute();
  }
}
