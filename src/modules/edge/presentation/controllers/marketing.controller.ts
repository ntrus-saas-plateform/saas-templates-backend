import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  EdgeRoute,
  Public,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  ApproveMarketingCampaignUseCase,
  CreateMarketingAudienceUseCase,
  CreateMarketingBudgetUseCase,
  CreateMarketingCampaignUseCase,
  CreateMarketingFormUseCase,
  CreateMarketingStrategyUseCase,
  GetMarketingCampaignUseCase,
  GetMarketingLeadUseCase,
  ListMarketingAudiencesUseCase,
  ListMarketingBudgetsUseCase,
  ListMarketingCampaignsUseCase,
  ListMarketingFormsUseCase,
  ListMarketingLeadsUseCase,
  ListMarketingStrategiesUseCase,
  PublishMarketingCampaignUseCase,
  PublishMarketingFormUseCase,
  ScoreMarketingLeadUseCase,
  SubmitMarketingFormPublicUseCase,
  TransitionMarketingCampaignUseCase,
} from '../../application/marketing/marketing.use-cases.js';
import {
  ActivateMarketingJourneyUseCase,
  ApproveMarketingContentUseCase,
  CalculateMarketingAttributionUseCase,
  CreateMarketingContentUseCase,
  CreateMarketingJourneyUseCase,
  CreateMarketingLandingPageUseCase,
  CreateMarketingMessageTemplateUseCase,
  CreateMarketingPerformanceSnapshotUseCase,
  CreateMarketingSuppressionUseCase,
  IngestMarketingDeliveryReceiptUseCase,
  ListMarketingAttributionModelsUseCase,
  ListMarketingChannelsUseCase,
  ListMarketingContentsUseCase,
  ListMarketingJourneysUseCase,
  ListMarketingLandingPagesUseCase,
  ListMarketingMessageTemplatesUseCase,
  ListMarketingPerformanceSnapshotsUseCase,
  PublishMarketingContentUseCase,
  PublishMarketingLandingPageUseCase,
  RequestMarketingDeliveryUseCase,
  ResumeWaitingMarketingJourneysUseCase,
  StartMarketingJourneyExecutionUseCase,
  AssignMarketingLeadUseCase,
  MergeMarketingLeadsUseCase,
  SummarizeMarketingAnalyticsUseCase,
  UpdateMarketingContentStudioUseCase,
  UpdateMarketingLandingStudioUseCase,
  UpsertMarketingChannelUseCase,
} from '../../application/marketing/marketing-orchestration.use-cases.js';
import { ProcessResendMarketingWebhookUseCase } from '../../application/marketing/resend-webhook.use-case.js';
import {
  ProcessMetaWhatsAppMarketingWebhookUseCase,
  VerifyMetaWhatsAppWebhookSubscriptionUseCase,
} from '../../application/marketing/whatsapp-webhook.use-case.js';

@ApiTags('edge-marketing')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/marketing')
export class EdgeMarketingController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly createStrategy: CreateMarketingStrategyUseCase,
    private readonly listStrategies: ListMarketingStrategiesUseCase,
    private readonly createAudience: CreateMarketingAudienceUseCase,
    private readonly listAudiences: ListMarketingAudiencesUseCase,
    private readonly createCampaign: CreateMarketingCampaignUseCase,
    private readonly listCampaigns: ListMarketingCampaignsUseCase,
    private readonly getCampaign: GetMarketingCampaignUseCase,
    private readonly transitionCampaign: TransitionMarketingCampaignUseCase,
    private readonly approveCampaign: ApproveMarketingCampaignUseCase,
    private readonly publishCampaign: PublishMarketingCampaignUseCase,
    private readonly createForm: CreateMarketingFormUseCase,
    private readonly listForms: ListMarketingFormsUseCase,
    private readonly publishForm: PublishMarketingFormUseCase,
    private readonly submitFormPublic: SubmitMarketingFormPublicUseCase,
    private readonly listLeads: ListMarketingLeadsUseCase,
    private readonly getLead: GetMarketingLeadUseCase,
    private readonly scoreLead: ScoreMarketingLeadUseCase,
    private readonly createBudget: CreateMarketingBudgetUseCase,
    private readonly listBudgets: ListMarketingBudgetsUseCase,
    private readonly createContent: CreateMarketingContentUseCase,
    private readonly listContents: ListMarketingContentsUseCase,
    private readonly approveContent: ApproveMarketingContentUseCase,
    private readonly publishContent: PublishMarketingContentUseCase,
    private readonly createLanding: CreateMarketingLandingPageUseCase,
    private readonly listLandings: ListMarketingLandingPagesUseCase,
    private readonly publishLanding: PublishMarketingLandingPageUseCase,
    private readonly listChannels: ListMarketingChannelsUseCase,
    private readonly upsertChannel: UpsertMarketingChannelUseCase,
    private readonly createTemplate: CreateMarketingMessageTemplateUseCase,
    private readonly listTemplates: ListMarketingMessageTemplatesUseCase,
    private readonly requestDelivery: RequestMarketingDeliveryUseCase,
    private readonly ingestReceipt: IngestMarketingDeliveryReceiptUseCase,
    private readonly processResendWebhook: ProcessResendMarketingWebhookUseCase,
    private readonly processWhatsAppWebhook: ProcessMetaWhatsAppMarketingWebhookUseCase,
    private readonly verifyWhatsAppWebhook: VerifyMetaWhatsAppWebhookSubscriptionUseCase,
    private readonly updateContentStudio: UpdateMarketingContentStudioUseCase,
    private readonly updateLandingStudio: UpdateMarketingLandingStudioUseCase,
    private readonly createJourney: CreateMarketingJourneyUseCase,
    private readonly listJourneys: ListMarketingJourneysUseCase,
    private readonly activateJourney: ActivateMarketingJourneyUseCase,
    private readonly startJourney: StartMarketingJourneyExecutionUseCase,
    private readonly listAttrModels: ListMarketingAttributionModelsUseCase,
    private readonly calculateAttr: CalculateMarketingAttributionUseCase,
    private readonly createPerfSnapshot: CreateMarketingPerformanceSnapshotUseCase,
    private readonly listPerfSnapshots: ListMarketingPerformanceSnapshotsUseCase,
    private readonly summarizeAnalytics: SummarizeMarketingAnalyticsUseCase,
    private readonly createSuppression: CreateMarketingSuppressionUseCase,
    private readonly resumeWaits: ResumeWaitingMarketingJourneysUseCase,
    private readonly assignLead: AssignMarketingLeadUseCase,
    private readonly mergeLeads: MergeMarketingLeadsUseCase,
  ) {}

  @Get('strategies')
  @RequireEdgePermissions('platform:marketing:strategy:read')
  async strategies(
    @Query('productId') productId?: string,
    @Query('verticalId') verticalId?: string,
  ) {
    return { data: await this.listStrategies.execute({ productId, verticalId }) };
  }

  @Post('strategies')
  @RequireEdgePermissions('platform:marketing:strategy:manage')
  async createStrategyEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      scopeType: string;
      productId?: string | null;
      verticalId?: string | null;
      marketId?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createStrategy.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Get('audiences')
  @RequireEdgePermissions('platform:marketing:audience:read')
  async audiences(@Query('productId') productId?: string) {
    return { data: await this.listAudiences.execute({ productId }) };
  }

  @Post('audiences')
  @RequireEdgePermissions('platform:marketing:audience:manage')
  async createAudienceEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      audienceKind?: string;
      productId?: string | null;
      verticalId?: string | null;
      rules?: {
        ruleType: string;
        criterionType: string;
        criterionRef?: string | null;
        criterionValue?: Record<string, unknown>;
      }[];
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createAudience.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Get('campaigns')
  @RequireEdgePermissions('platform:marketing:campaign:read')
  async campaigns(
    @Query('productId') productId?: string,
    @Query('status') status?: string,
  ) {
    return { data: await this.listCampaigns.execute({ productId, status }) };
  }

  @Get('campaigns/:id')
  @RequireEdgePermissions('platform:marketing:campaign:read')
  async campaign(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.getCampaign.execute(id) };
  }

  @Post('campaigns')
  @RequireEdgePermissions('platform:marketing:campaign:create')
  async createCampaignEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      campaignType: string;
      objective?: string | null;
      productId: string;
      verticalId?: string | null;
      marketId?: string | null;
      segmentId?: string | null;
      icpId?: string | null;
      personaId?: string | null;
      offerType?: string | null;
      offerId?: string | null;
      audienceId?: string | null;
      strategyId?: string | null;
      budgetAmount?: string | null;
      budgetCurrency?: string | null;
      channels?: unknown[];
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createCampaign.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Post('campaigns/:id/transition')
  @RequireEdgePermissions('platform:marketing:campaign:update')
  async transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { toStatus: string },
  ) {
    return {
      data: await this.transitionCampaign.execute({
        campaignId: id,
        toStatus: body.toStatus,
      }),
    };
  }

  @Post('campaigns/:id/approvals')
  @RequireEdgePermissions('platform:marketing:campaign:approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      approvalType: string;
      decision: 'APPROVED' | 'REJECTED';
      notes?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.approveCampaign.execute({
        actorId: ctx.administratorId!,
        campaignId: id,
        ...body,
      }),
    };
  }

  @Post('campaigns/:id/publish')
  @RequireEdgePermissions('platform:marketing:campaign:publish')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishCampaign.execute({
        actorId: ctx.administratorId!,
        campaignId: id,
      }),
    };
  }

  @Get('forms')
  @RequireEdgePermissions('platform:marketing:form:manage')
  async forms(@Query('productId') productId?: string) {
    return { data: await this.listForms.execute({ productId }) };
  }

  @Post('forms')
  @RequireEdgePermissions('platform:marketing:form:manage')
  async createFormEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      formType: string;
      slug: string;
      productId?: string | null;
      campaignId?: string | null;
      fields?: unknown[];
      requiredConsents?: unknown[];
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createForm.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Post('forms/:id/publish')
  @RequireEdgePermissions('platform:marketing:form:manage')
  async publishFormEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.publishForm.execute(id) };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('forms/public/:slug/submissions')
  async publicSubmit(
    @Param('slug') slug: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body()
    body: {
      payload: Record<string, unknown>;
      utm?: Record<string, unknown>;
      sourceUrl?: string | null;
      consents?: { purpose: string; channel: string; textVersion: string }[];
      idempotencyKey?: string;
    },
  ) {
    return {
      data: await this.submitFormPublic.execute({
        slug,
        idempotencyKey: idempotencyKey ?? body.idempotencyKey ?? null,
        payload: body.payload ?? {},
        utm: body.utm,
        sourceUrl: body.sourceUrl,
        consents: body.consents,
        actorId: 'public-form',
      }),
    };
  }

  @Get('leads')
  @RequireEdgePermissions('platform:marketing:lead:read')
  async leads(
    @Query('status') status?: string,
    @Query('productId') productId?: string,
  ) {
    return { data: await this.listLeads.execute({ status, productId }) };
  }

  @Get('leads/:id')
  @RequireEdgePermissions('platform:marketing:lead:read')
  async lead(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.getLead.execute(id) };
  }

  @Post('leads/:id/score')
  @RequireEdgePermissions('platform:marketing:lead:manage')
  async score(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      signals: {
        icpMatch?: boolean;
        segmentMatch?: boolean;
        demoRequest?: boolean;
        explicitContact?: boolean;
        resourceDownload?: boolean;
        eventParticipation?: boolean;
        daysSinceLastActivity?: number | null;
        profileCompletenessRatio?: number | null;
      };
      qualifyThreshold?: number;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.scoreLead.execute({
        actorId: ctx.administratorId!,
        leadId: id,
        signals: body.signals ?? {},
        qualifyThreshold: body.qualifyThreshold,
      }),
    };
  }

  @Get('budgets')
  @RequireEdgePermissions('platform:marketing:budget:read')
  async budgets() {
    return { data: await this.listBudgets.execute() };
  }

  @Post('budgets')
  @RequireEdgePermissions('platform:marketing:budget:manage')
  async createBudgetEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      scopeType: string;
      currency: string;
      plannedAmount: string;
      productId?: string | null;
      verticalId?: string | null;
      campaignId?: string | null;
    },
  ) {
    return { data: await this.createBudget.execute(body) };
  }

  @Get('contents')
  @RequireEdgePermissions('platform:marketing:content:read')
  async contents(@Query('productId') productId?: string) {
    return { data: await this.listContents.execute({ productId }) };
  }

  @Post('contents')
  @RequireEdgePermissions('platform:marketing:content:manage')
  async createContentEndpoint(
    @Body()
    payload: {
      code: string;
      name: string;
      contentType: string;
      productId?: string | null;
      verticalId?: string | null;
      locale?: string;
      body?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createContent.execute({
        actorId: ctx.administratorId!,
        code: payload.code,
        name: payload.name,
        contentType: payload.contentType,
        productId: payload.productId,
        verticalId: payload.verticalId,
        locale: payload.locale,
        body: payload.body,
      }),
    };
  }

  @Post('contents/:id/approve')
  @RequireEdgePermissions('platform:marketing:content:approve')
  async approveContentEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.approveContent.execute(id) };
  }

  @Post('contents/:id/publish')
  @RequireEdgePermissions('platform:marketing:content:manage')
  async publishContentEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.publishContent.execute(id) };
  }

  @Put('contents/:id/studio')
  @RequireEdgePermissions('platform:marketing:content:manage')
  async updateContentStudioEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { studio: unknown },
  ) {
    return {
      data: await this.updateContentStudio.execute({ id, studio: body.studio }),
    };
  }

  @Get('landing-pages')
  @RequireEdgePermissions('platform:marketing:landing_page:manage')
  async landingPages(@Query('productId') productId?: string) {
    return { data: await this.listLandings.execute({ productId }) };
  }

  @Post('landing-pages')
  @RequireEdgePermissions('platform:marketing:landing_page:manage')
  async createLandingEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      pageType: string;
      slug: string;
      productId?: string | null;
      campaignId?: string | null;
      formId?: string | null;
      locale?: string;
      layout?: Record<string, unknown>;
      seo?: Record<string, unknown>;
      cta?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createLanding.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Post('landing-pages/:id/publish')
  @RequireEdgePermissions('platform:marketing:landing_page:manage')
  async publishLandingEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.publishLanding.execute(id) };
  }

  @Put('landing-pages/:id/studio')
  @RequireEdgePermissions('platform:marketing:landing_page:manage')
  async updateLandingStudioEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { studio: unknown },
  ) {
    return {
      data: await this.updateLandingStudio.execute({ id, studio: body.studio }),
    };
  }

  @Get('channels')
  @RequireEdgePermissions('platform:marketing:integrations:manage')
  async channels() {
    return { data: await this.listChannels.execute() };
  }

  @Post('channels')
  @RequireEdgePermissions('platform:marketing:integrations:manage')
  async upsertChannelEndpoint(
    @Body()
    body: {
      code: string;
      channelType: string;
      displayName: string;
      status?: string;
      providerRef?: string | null;
      secretRef?: string | null;
      settings?: Record<string, unknown>;
    },
  ) {
    return { data: await this.upsertChannel.execute(body) };
  }

  @Get('templates')
  @RequireEdgePermissions('platform:marketing:content:read')
  async templates() {
    return { data: await this.listTemplates.execute() };
  }

  @Post('templates')
  @RequireEdgePermissions('platform:marketing:content:manage')
  async createTemplateEndpoint(
    @Body()
    payload: {
      code: string;
      name: string;
      channelType: string;
      locale?: string;
      subject?: string | null;
      body?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createTemplate.execute({
        actorId: ctx.administratorId!,
        code: payload.code,
        name: payload.name,
        channelType: payload.channelType,
        locale: payload.locale,
        subject: payload.subject,
        body: payload.body,
      }),
    };
  }

  @Post('deliveries/request')
  @RequireEdgePermissions('platform:marketing:integrations:manage')
  async requestDeliveryEndpoint(
    @Body()
    body: {
      channelConfigId: string;
      leadId: string;
      templateId?: string | null;
      campaignId?: string | null;
      purpose: string;
      channel: string;
      idempotencyKey: string;
    },
  ) {
    return { data: await this.requestDelivery.execute(body) };
  }

  /**
   * Manual/admin receipt ingest — NOT public.
   * signatureValid is forced true only for operators with integrations permission;
   * external providers must use /deliveries/webhooks/resend (Svix-verified).
   */
  @Post('deliveries/receipts')
  @RequireEdgePermissions('platform:marketing:integrations:manage')
  async ingestReceiptEndpoint(
    @Body()
    body: {
      deliveryAttemptId: string;
      providerEventId: string;
      receiptStatus: 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'OPENED' | 'CLICKED' | 'UNKNOWN';
      rawPayload?: Record<string, unknown>;
    },
  ) {
    return {
      data: await this.ingestReceipt.execute({
        ...body,
        signatureValid: true,
        source: 'operator',
      }),
    };
  }

  /**
   * Resend (Svix) webhook — verifies signature, never trusts unsigned DELIVERED.
   * Configure Resend dashboard URL to this path.
   */
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('deliveries/webhooks/resend')
  async resendWebhookEndpoint(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ) {
    const rawBody =
      req.rawBody?.toString('utf8') ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    return {
      data: await this.processResendWebhook.execute({
        rawBody,
        headers: {
          id: svixId ?? '',
          timestamp: svixTimestamp ?? '',
          signature: svixSignature ?? '',
        },
      }),
    };
  }

  /** Meta WhatsApp Cloud API webhook subscription handshake. */
  @Public()
  @Get('deliveries/webhooks/whatsapp')
  whatsappWebhookVerify(
    @Res() res: Response,
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): void {
    const value = this.verifyWhatsAppWebhook.execute({ mode, token, challenge });
    res.status(200).contentType('text/plain').send(value);
  }

  /** Meta WhatsApp status webhooks — X-Hub-Signature-256 required. */
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('deliveries/webhooks/whatsapp')
  async whatsappWebhookEndpoint(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const rawBody =
      req.rawBody?.toString('utf8') ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    return {
      data: await this.processWhatsAppWebhook.execute({
        rawBody,
        signatureHeader: signature,
      }),
    };
  }

  @Get('journeys')
  @RequireEdgePermissions('platform:marketing:automation:manage')
  async journeys() {
    return { data: await this.listJourneys.execute() };
  }

  @Post('journeys')
  @RequireEdgePermissions('platform:marketing:automation:manage')
  async createJourneyEndpoint(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      productId?: string | null;
      triggerType: string;
      definition: {
        entryStepKey: string;
        steps: {
          key: string;
          type: 'SEND_MESSAGE' | 'UPDATE_STATUS' | 'SCORE_LEAD' | 'WAIT' | 'STOP' | 'BRANCH';
          channel?: string;
          purpose?: string;
          templateCode?: string;
          toStatus?: string;
          waitHours?: number;
          next?: string | null;
          onTrue?: string | null;
          onFalse?: string | null;
          condition?: 'HAS_CONSENT' | 'ALWAYS';
        }[];
      };
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createJourney.execute({
        actorId: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Post('journeys/:id/activate')
  @RequireEdgePermissions('platform:marketing:automation:manage')
  async activateJourneyEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.activateJourney.execute(id) };
  }

  @Post('journeys/:id/executions')
  @RequireEdgePermissions('platform:marketing:automation:manage')
  async startJourneyEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { leadId: string; idempotencyKey: string },
  ) {
    return {
      data: await this.startJourney.execute({
        journeyId: id,
        leadId: body.leadId,
        idempotencyKey: body.idempotencyKey,
      }),
    };
  }

  @Get('attribution/models')
  @RequireEdgePermissions('platform:marketing:analytics:read')
  async attributionModels() {
    return { data: await this.listAttrModels.execute() };
  }

  @Post('attribution/calculate')
  @RequireEdgePermissions('platform:marketing:analytics:read')
  async calculateAttributionEndpoint(
    @Body() body: { leadId: string; modelCode: string; conversionKey: string },
  ) {
    return { data: await this.calculateAttr.execute(body) };
  }

  @Get('analytics/snapshots')
  @RequireEdgePermissions('platform:marketing:analytics:read')
  async analyticsSnapshots(@Query('scopeType') scopeType?: string) {
    return { data: await this.listPerfSnapshots.execute({ scopeType }) };
  }

  @Get('analytics/summary')
  @RequireEdgePermissions('platform:marketing:analytics:read')
  async analyticsSummary(@Query('scopeType') scopeType?: string) {
    return { data: await this.summarizeAnalytics.execute({ scopeType }) };
  }

  @Post('analytics/snapshots')
  @RequireEdgePermissions('platform:marketing:analytics:read')
  async createAnalyticsSnapshotEndpoint(
    @Body()
    body: {
      scopeType: string;
      scopeId?: string | null;
      periodStart: string;
      periodEnd: string;
      metrics: Record<string, unknown>;
      metricQuality: Record<string, string>;
    },
  ) {
    return { data: await this.createPerfSnapshot.execute(body) };
  }

  @Post('suppressions')
  @RequireEdgePermissions('platform:marketing:lead:manage')
  async createSuppressionEndpoint(
    @Body()
    body: {
      leadId?: string | null;
      emailNormalized?: string | null;
      channel: string;
      reason: string;
    },
  ) {
    return { data: await this.createSuppression.execute(body) };
  }

  @Post('journeys/waits/resume')
  @RequireEdgePermissions('platform:marketing:automation:manage')
  async resumeWaitsEndpoint(@Body() body?: { limit?: number }) {
    return { data: await this.resumeWaits.execute({ limit: body?.limit }) };
  }

  @Post('leads/:id/assign')
  @RequireEdgePermissions('platform:marketing:lead:assign')
  async assignLeadEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { assignedTo: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.assignLead.execute({
        leadId: id,
        assignedTo: body.assignedTo,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Post('leads/merge')
  @RequireEdgePermissions('platform:marketing:lead:manage')
  async mergeLeadsEndpoint(
    @Body() body: { keepLeadId: string; duplicateLeadId: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.mergeLeads.execute({
        keepLeadId: body.keepLeadId,
        duplicateLeadId: body.duplicateLeadId,
        actorId: ctx.administratorId!,
      }),
    };
  }
}
