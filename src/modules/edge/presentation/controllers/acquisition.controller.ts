import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  AcceptQuoteUseCase,
  AdvanceJourneyUseCase,
  AttachPaymentReferenceUseCase,
  AttachQuoteReferenceUseCase,
  CaptureAcquisitionLeadUseCase,
  CompleteSubscriptionHandoffUseCase,
  CreateApplicationDraftUseCase,
  CreateCheckoutSessionUseCase,
  CreateDocumentRequirementUseCase,
  CreateFormSchemaUseCase,
  CreateFormVersionUseCase,
  InstantiateProductAcquisitionFormUseCase,
  CreatePlanPresentationUseCase,
  CreateProductContentVersionUseCase,
  CreateProductPresentationUseCase,
  CreateProspectUseCase,
  CreateQuoteRequestUseCase,
  CreateSegmentPresentationUseCase,
  DecideQualificationUseCase,
  GetAcquisitionOverviewUseCase,
  GetConversionFunnelUseCase,
  GetCustomerPortalSnapshotUseCase,
  GetJourneyByApplicationUseCase,
  ListApplicationsUseCase,
  ListDocumentReferencesUseCase,
  ListFormSchemasUseCase,
  ListLeadsUseCase,
  ListPlanPresentationsUseCase,
  ListProductPresentationsUseCase,
  ListProspectsUseCase,
  ListQuoteRequestsUseCase,
  ListSegmentPresentationsUseCase,
  MarkCommunicationStatusUseCase,
  GetCheckoutSessionUseCase,
  InitiateAcquisitionPaymentUseCase,
  ListCheckoutSessionsUseCase,
  ListSubscriptionHandoffsUseCase,
  PromoteLeadUseCase,
  PublishFormVersionUseCase,
  PublishProductContentUseCase,
  QueueAcquisitionCommunicationUseCase,
  RecordAnalyticsEventUseCase,
  RecordPaymentResultUseCase,
  RegisterDocumentUploadUseCase,
  RequestMissingInformationUseCase,
  RequestSubscriptionHandoffUseCase,
  RevalidatePlanBeforeCheckoutUseCase,
  ReviewDocumentUseCase,
  SaveApplicationAnswersUseCase,
  StartQualificationUseCase,
  SubmitApplicationUseCase,
  TransitionApplicationReviewUseCase,
  TransitionProspectUseCase,
} from '../../application/acquisition/acquisition.use-cases.js';
import {
  AcquisitionListQueryDto,
  AdvanceJourneyDto,
  AttachPaymentDto,
  AttachQuoteReferenceDto,
  CaptureLeadDto,
  CompleteHandoffDto,
  CreateApplicationDraftDto,
  CreateCheckoutDto,
  CreateDocumentRequirementDto,
  CreateFormSchemaDto,
  CreateFormVersionDto,
  InstantiateProductAcquisitionFormDto,
  SubmitApplicationDto,
  CreatePlanPresentationDto,
  CreateProductPresentationDto,
  CreateProspectDto,
  CreateQuoteRequestDto,
  PublishFormVersionDto,
  CreateSegmentPresentationDto,
  DecideQualificationDto,
  FunnelQueryDto,
  InitiateAcquisitionPaymentDto,
  PromoteLeadDto,
  PublishContentDto,
  QueueCommunicationDto,
  RecordAnalyticsDto,
  RecordPaymentResultDto,
  RegisterDocumentDto,
  RequestHandoffDto,
  RequestInformationDto,
  RevalidatePlanDto,
  ReviewDocumentDto,
  SaveAnswersDto,
  StartQualificationDto,
  TransitionApplicationDto,
  TransitionProspectDto,
  UpdateCommunicationStatusDto,
} from '../dto/acquisition.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

@ApiTags('edge-p10-acquisition')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class AcquisitionController {
  constructor(
    private readonly overview: GetAcquisitionOverviewUseCase,
    private readonly listProducts: ListProductPresentationsUseCase,
    private readonly createProduct: CreateProductPresentationUseCase,
    private readonly createContent: CreateProductContentVersionUseCase,
    private readonly publishContent: PublishProductContentUseCase,
    private readonly listPlans: ListPlanPresentationsUseCase,
    private readonly createPlan: CreatePlanPresentationUseCase,
    private readonly listSegments: ListSegmentPresentationsUseCase,
    private readonly createSegment: CreateSegmentPresentationUseCase,
    private readonly listProspects: ListProspectsUseCase,
    private readonly createProspect: CreateProspectUseCase,
    private readonly transitionProspect: TransitionProspectUseCase,
    private readonly listLeads: ListLeadsUseCase,
    private readonly captureLead: CaptureAcquisitionLeadUseCase,
    private readonly promoteLead: PromoteLeadUseCase,
    private readonly listForms: ListFormSchemasUseCase,
    private readonly createForm: CreateFormSchemaUseCase,
    private readonly instantiateFromContract: InstantiateProductAcquisitionFormUseCase,
    private readonly createFormVersion: CreateFormVersionUseCase,
    private readonly publishFormVersion: PublishFormVersionUseCase,
    private readonly listApplications: ListApplicationsUseCase,
    private readonly createApplication: CreateApplicationDraftUseCase,
    private readonly saveAnswers: SaveApplicationAnswersUseCase,
    private readonly submitApplication: SubmitApplicationUseCase,
    private readonly transitionApplication: TransitionApplicationReviewUseCase,
    private readonly requestInformation: RequestMissingInformationUseCase,
    private readonly listDocuments: ListDocumentReferencesUseCase,
    private readonly registerDocument: RegisterDocumentUploadUseCase,
    private readonly reviewDocument: ReviewDocumentUseCase,
    private readonly createDocumentRequirement: CreateDocumentRequirementUseCase,
    private readonly startQualification: StartQualificationUseCase,
    private readonly decideQualification: DecideQualificationUseCase,
    private readonly listQuotes: ListQuoteRequestsUseCase,
    private readonly createQuote: CreateQuoteRequestUseCase,
    private readonly attachQuoteRef: AttachQuoteReferenceUseCase,
    private readonly acceptQuote: AcceptQuoteUseCase,
    private readonly createCheckout: CreateCheckoutSessionUseCase,
    private readonly getCheckout: GetCheckoutSessionUseCase,
    private readonly listCheckouts: ListCheckoutSessionsUseCase,
    private readonly listHandoffs: ListSubscriptionHandoffsUseCase,
    private readonly attachPayment: AttachPaymentReferenceUseCase,
    private readonly initiatePayment: InitiateAcquisitionPaymentUseCase,
    private readonly recordPayment: RecordPaymentResultUseCase,
    private readonly revalidatePlan: RevalidatePlanBeforeCheckoutUseCase,
    private readonly requestHandoff: RequestSubscriptionHandoffUseCase,
    private readonly completeHandoff: CompleteSubscriptionHandoffUseCase,
    private readonly getJourneyByApplication: GetJourneyByApplicationUseCase,
    private readonly advanceJourney: AdvanceJourneyUseCase,
    private readonly customerPortal: GetCustomerPortalSnapshotUseCase,
    private readonly queueCommunication: QueueAcquisitionCommunicationUseCase,
    private readonly markCommunication: MarkCommunicationStatusUseCase,
    private readonly recordAnalytics: RecordAnalyticsEventUseCase,
    private readonly funnel: GetConversionFunnelUseCase,
  ) {}

  @Get('edge/acquisition/overview')
  @RequireEdgePermissions('platform:acquisition:read')
  @ApiOperation({ summary: 'Acquisition CX overview counts' })
  async acquisitionOverview(@Query('verticalId') verticalId?: string) {
    return this.overview.execute(verticalId);
  }

  @Get('edge/acquisition/products')
  @RequireEdgePermissions('platform:acquisition:read')
  async getProducts(@Query() query: AcquisitionListQueryDto) {
    return this.listProducts.execute(query);
  }

  @Post('edge/acquisition/products')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postProduct(@Body() body: CreateProductPresentationDto, @Req() req: EdgeRequest) {
    return this.createProduct.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/products/:id/content')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postProductContent(
    @Param('id') id: string,
    @Body() body: PublishContentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createContent.execute({
      actorId: actorId(req),
      presentationId: id,
      content: body.content ?? {},
      versionNumber: body.versionNumber,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/products/:id/content/:versionId/publish')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postPublishProductContent(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body() body: PublishContentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.publishContent.execute({
      actorId: actorId(req),
      presentationId: id,
      contentVersionId: versionId,
      content: body.content,
      versionNumber: body.versionNumber,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/plans')
  @RequireEdgePermissions('platform:acquisition:read')
  async getPlans(@Query() query: AcquisitionListQueryDto) {
    return this.listPlans.execute(query);
  }

  @Post('edge/acquisition/plans')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postPlan(@Body() body: CreatePlanPresentationDto, @Req() req: EdgeRequest) {
    return this.createPlan.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/segments')
  @RequireEdgePermissions('platform:acquisition:read')
  async getSegments(@Query() query: AcquisitionListQueryDto) {
    return this.listSegments.execute(query);
  }

  @Post('edge/acquisition/segments')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postSegment(@Body() body: CreateSegmentPresentationDto, @Req() req: EdgeRequest) {
    return this.createSegment.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/prospects')
  @RequireEdgePermissions('platform:acquisition:read')
  async getProspects(@Query() query: AcquisitionListQueryDto) {
    return this.listProspects.execute(query);
  }

  @Post('edge/acquisition/prospects')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postProspect(@Body() body: CreateProspectDto, @Req() req: EdgeRequest) {
    return this.createProspect.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/prospects/:id/transition')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postProspectTransition(
    @Param('id') id: string,
    @Body() body: TransitionProspectDto,
    @Req() req: EdgeRequest,
  ) {
    return this.transitionProspect.execute({
      actorId: actorId(req),
      prospectId: id,
      toStatus: body.toStatus,
      patch: body.patch,
      expectedVersion: body.expectedVersion,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/leads')
  @RequireEdgePermissions('platform:acquisition:read')
  async getLeads(@Query() query: AcquisitionListQueryDto) {
    return this.listLeads.execute(query);
  }

  @Post('edge/acquisition/leads')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postLead(@Body() body: CaptureLeadDto, @Req() req: EdgeRequest) {
    return this.captureLead.execute({
      actorId: actorId(req),
      ...body,
      // Authenticated operators are not subject to the public math CAPTCHA.
      bypassPublicChallenge: true,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/leads/:id/promote')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postPromoteLead(
    @Param('id') id: string,
    @Body() body: PromoteLeadDto,
    @Req() req: EdgeRequest,
  ) {
    return this.promoteLead.execute({
      actorId: actorId(req),
      leadId: id,
      prospectId: body.prospectId,
      createProspectIfMissing: body.createProspectIfMissing,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/forms')
  @RequireEdgePermissions('platform:acquisition:read')
  async getForms(@Query() query: AcquisitionListQueryDto) {
    return this.listForms.execute(query);
  }

  @Post('edge/acquisition/forms')
  @RequireEdgePermissions('platform:acquisition:forms:manage')
  async postForm(@Body() body: CreateFormSchemaDto, @Req() req: EdgeRequest) {
    return this.createForm.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/forms/from-contract')
  @RequireEdgePermissions('platform:acquisition:forms:manage')
  @ApiOperation({
    summary:
      'Instantiate a DRAFT form schema + version from a product-owned acquisition contract template (does not publish)',
  })
  async postFormFromContract(
    @Body() body: InstantiateProductAcquisitionFormDto,
    @Req() req: EdgeRequest,
  ) {
    return this.instantiateFromContract.execute({
      actorId: actorId(req),
      productId: body.productId,
      contractCode: body.contractCode,
      code: body.code,
      name: body.name,
      description: body.description,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/forms/:id/versions')
  @RequireEdgePermissions('platform:acquisition:forms:manage')
  async postFormVersion(
    @Param('id') id: string,
    @Body() body: CreateFormVersionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createFormVersion.execute({
      actorId: actorId(req),
      formSchemaId: id,
      schemaDefinition: body.schemaDefinition as never,
      versionNumber: body.versionNumber ?? 1,
      conditionRules: Array.isArray(body.conditionRules)
        ? body.conditionRules
        : body.conditionRules != null
          ? [body.conditionRules]
          : undefined,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/forms/versions/:versionId/publish')
  @RequireEdgePermissions('platform:acquisition:forms:publish')
  async postPublishFormVersion(
    @Param('versionId') versionId: string,
    @Body() body: PublishFormVersionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.publishFormVersion.execute({
      actorId: actorId(req),
      formVersionId: versionId,
      channel: body.channel,
      publicSlug: body.publicSlug,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/applications')
  @RequireEdgePermissions('platform:acquisition:read')
  async getApplications(@Query() query: AcquisitionListQueryDto) {
    return this.listApplications.execute(query);
  }

  @Post('edge/acquisition/applications')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postApplication(@Body() body: CreateApplicationDraftDto, @Req() req: EdgeRequest) {
    return this.createApplication.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/applications/:id/answers')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postApplicationAnswers(
    @Param('id') id: string,
    @Body() body: SaveAnswersDto,
    @Req() req: EdgeRequest,
  ) {
    return this.saveAnswers.execute({
      actorId: actorId(req),
      applicationId: id,
      answers: body.answers,
      expectedVersion: body.expectedVersion,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/applications/:id/submit')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postSubmitApplication(
    @Param('id') id: string,
    @Req() req: EdgeRequest,
    @Body() body?: SubmitApplicationDto,
  ) {
    return this.submitApplication.execute({
      actorId: actorId(req),
      applicationId: id,
      consents: body?.consents,
      correlationId: body?.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/applications/:id/transition')
  @RequireEdgePermissions('platform:acquisition:review')
  async postApplicationTransition(
    @Param('id') id: string,
    @Body() body: TransitionApplicationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.transitionApplication.execute({
      actorId: actorId(req),
      applicationId: id,
      toStatus: body.toStatus,
      decisionReason: body.decisionReason,
      expectedVersion: body.expectedVersion,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/applications/:id/request-information')
  @RequireEdgePermissions('platform:acquisition:review')
  async postRequestInformation(
    @Param('id') id: string,
    @Body() body: RequestInformationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestInformation.execute({
      actorId: actorId(req),
      applicationId: id,
      reason: body.reason,
      missingFields: body.missingFields,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/documents')
  @RequireEdgePermissions('platform:acquisition:read')
  async getDocuments(@Query() query: AcquisitionListQueryDto) {
    return this.listDocuments.execute({
      applicationId: query.applicationId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post('edge/acquisition/documents')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postDocument(@Body() body: RegisterDocumentDto, @Req() req: EdgeRequest) {
    return this.registerDocument.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/documents/:id/review')
  @RequireEdgePermissions('platform:acquisition:documents:review')
  async postDocumentReview(
    @Param('id') id: string,
    @Body() body: ReviewDocumentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.reviewDocument.execute({
      actorId: actorId(req),
      documentReferenceId: id,
      decision: body.decision,
      comments: body.comments,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/document-requirements')
  @RequireEdgePermissions('platform:acquisition:forms:manage')
  async postDocumentRequirement(
    @Body() body: CreateDocumentRequirementDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createDocumentRequirement.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      formSchemaId: body.formSchemaId,
      documentType: body.documentType,
      required: body.required,
      conditionRules: Array.isArray(body.conditionRules)
        ? body.conditionRules
        : body.conditionRules != null
          ? [body.conditionRules]
          : undefined,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/qualification/start')
  @RequireEdgePermissions('platform:acquisition:review')
  async postStartQualification(@Body() body: StartQualificationDto, @Req() req: EdgeRequest) {
    return this.startQualification.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/qualification/:id/decide')
  @RequireEdgePermissions('platform:acquisition:approve')
  async postDecideQualification(
    @Param('id') id: string,
    @Body() body: DecideQualificationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.decideQualification.execute({
      actorId: actorId(req),
      applicationId: id,
      decision: body.decision,
      outcomeSummary: body.outcomeSummary,
      evidence: body.evidence,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/quotations')
  @RequireEdgePermissions('platform:acquisition:read')
  async getQuotations(@Query() query: AcquisitionListQueryDto) {
    return this.listQuotes.execute({
      prospectId: query.prospectId,
      status: query.status,
      applicationId: query.applicationId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post('edge/acquisition/quotations')
  @RequireEdgePermissions('platform:acquisition:quotes:manage')
  async postQuotation(@Body() body: CreateQuoteRequestDto, @Req() req: EdgeRequest) {
    return this.createQuote.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/quotations/:id/references')
  @RequireEdgePermissions('platform:acquisition:quotes:manage')
  async postQuoteReference(
    @Param('id') id: string,
    @Body() body: AttachQuoteReferenceDto,
    @Req() req: EdgeRequest,
  ) {
    return this.attachQuoteRef.execute({
      actorId: actorId(req),
      quoteRequestId: id,
      externalQuoteRef: body.externalQuoteRef,
      commercialSource: body.commercialSource,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      displaySummary: body.displaySummary,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/quotations/:id/accept')
  @RequireEdgePermissions('platform:acquisition:quotes:manage')
  async postAcceptQuote(@Param('id') id: string, @Req() req: EdgeRequest) {
    return this.acceptQuote.execute({
      actorId: actorId(req),
      quoteRequestId: id,
      correlationId: randomUUID(),
    });
  }

  @Get('edge/acquisition/checkout')
  @RequireEdgePermissions('platform:acquisition:read')
  async getCheckouts(@Query() query: AcquisitionListQueryDto) {
    return this.listCheckouts.execute(query);
  }

  @Get('edge/acquisition/checkout/:id')
  @RequireEdgePermissions('platform:acquisition:read')
  async getCheckoutById(@Param('id') id: string) {
    return this.getCheckout.execute({ id });
  }

  @Post('edge/acquisition/checkout')
  @RequireEdgePermissions('platform:acquisition:checkout:operate')
  async postCheckout(@Body() body: CreateCheckoutDto, @Req() req: EdgeRequest) {
    return this.createCheckout.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/handoffs')
  @RequireEdgePermissions('platform:acquisition:read')
  async getHandoffs(@Query() query: AcquisitionListQueryDto) {
    return this.listHandoffs.execute(query);
  }

  @Post('edge/acquisition/checkout/:id/payment-reference')
  @RequireEdgePermissions('platform:acquisition:checkout:operate')
  async postPaymentReference(
    @Param('id') id: string,
    @Body() body: AttachPaymentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.attachPayment.execute({
      actorId: actorId(req),
      checkoutSessionId: id,
      paymentIntentRef: body.paymentIntentRef,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/checkout/:id/initiate-payment')
  @RequireEdgePermissions('platform:acquisition:checkout:operate')
  @ApiOperation({
    summary:
      'Orchestrate P6 payment intent creation and attach reference (never marks checkout paid on SUCCEEDED alone)',
  })
  async postInitiatePayment(
    @Param('id') id: string,
    @Body() body: InitiateAcquisitionPaymentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.initiatePayment.execute({
      actorId: actorId(req),
      checkoutSessionId: id,
      billingAccountId: body.billingAccountId,
      amount: body.amount,
      currency: body.currency,
      termsConfirmed: body.termsConfirmed,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/checkout/:id/payment-result')
  @RequireEdgePermissions('platform:acquisition:checkout:operate')
  async postPaymentResult(
    @Param('id') id: string,
    @Body() body: RecordPaymentResultDto,
    @Req() req: EdgeRequest,
  ) {
    return this.recordPayment.execute({
      actorId: actorId(req),
      checkoutSessionId: id,
      p6Status: body.p6Status,
      externalRef: body.externalRef,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/checkout/revalidate-plan')
  @RequireEdgePermissions('platform:acquisition:checkout:operate')
  async postRevalidatePlan(@Body() body: RevalidatePlanDto) {
    return this.revalidatePlan.execute(body);
  }

  @Post('edge/acquisition/handoffs')
  @RequireEdgePermissions('platform:acquisition:checkout:operate')
  async postHandoff(@Body() body: RequestHandoffDto, @Req() req: EdgeRequest) {
    return this.requestHandoff.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/handoffs/:id/complete')
  @RequireEdgePermissions('platform:acquisition:checkout:operate')
  async postCompleteHandoff(
    @Param('id') id: string,
    @Body() body: CompleteHandoffDto,
    @Req() req: EdgeRequest,
  ) {
    return this.completeHandoff.execute({
      actorId: actorId(req),
      handoffId: id,
      subscriptionId: body.subscriptionId,
      externalEvidenceRef: body.externalEvidenceRef,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/journeys/:applicationId')
  @RequireEdgePermissions('platform:acquisition:read')
  async getJourney(@Param('applicationId') applicationId: string) {
    return this.getJourneyByApplication.execute({ applicationId });
  }

  @Post('edge/acquisition/journeys/:id/advance')
  @RequireEdgePermissions('platform:acquisition:governance:manage')
  async postAdvanceJourney(
    @Param('id') id: string,
    @Body() body: AdvanceJourneyDto,
    @Req() req: EdgeRequest,
  ) {
    return this.advanceJourney.execute({
      actorId: actorId(req),
      journeyInstanceId: id,
      toStepKey: body.toStepKey,
      contextPatch: body.contextPatch,
      complete: body.complete,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/customer-portal/:prospectId')
  @RequireEdgePermissions('platform:acquisition:read')
  async getCustomerPortal(@Param('prospectId') prospectId: string) {
    return this.customerPortal.execute({ prospectId });
  }

  @Post('edge/acquisition/communications')
  @RequireEdgePermissions('platform:acquisition:governance:manage')
  async postCommunication(@Body() body: QueueCommunicationDto, @Req() req: EdgeRequest) {
    return this.queueCommunication.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Patch('edge/acquisition/communications/:id/status')
  @RequireEdgePermissions('platform:acquisition:governance:manage')
  async patchCommunicationStatus(
    @Param('id') id: string,
    @Body() body: UpdateCommunicationStatusDto,
    @Req() req: EdgeRequest,
  ) {
    return this.markCommunication.execute({
      actorId: actorId(req),
      communicationId: id,
      status: body.status,
      providerRef: body.providerRef,
      metadata: body.metadata,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/acquisition/analytics/events')
  @RequireEdgePermissions('platform:acquisition:manage')
  async postAnalyticsEvent(@Body() body: RecordAnalyticsDto, @Req() req: EdgeRequest) {
    return this.recordAnalytics.execute({
      actorId: actorId(req),
      eventName: body.eventName,
      prospectId: body.prospectId,
      leadId: body.leadId,
      applicationId: body.applicationId,
      sessionKey: body.sessionKey,
      properties: body.properties,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/acquisition/analytics/funnel')
  @RequireEdgePermissions('platform:acquisition:analytics:read')
  async getFunnel(@Query() query: FunnelQueryDto) {
    return this.funnel.execute({
      prospectId: query.prospectId,
      verticalId: query.verticalId,
      limit: query.limit,
    });
  }
}
