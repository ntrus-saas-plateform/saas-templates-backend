import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { EdgeRoute, Public } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  CaptureAcquisitionLeadUseCase,
  GetPublicCheckoutSessionUseCase,
  GetPublicFormBySlugUseCase,
  GetPublicProductPageUseCase,
  IssueAcquisitionChallengeUseCase,
  ListPlanPresentationsUseCase,
  ListPublicProductDiscoveryUseCase,
  RecordAnalyticsEventUseCase,
} from '../../application/acquisition/acquisition.use-cases.js';
import {
  AcquisitionListQueryDto,
  CaptureLeadDto,
  PublicPlansQueryDto,
  RecordAnalyticsDto,
} from '../dto/acquisition.dto.js';

@ApiTags('edge-p10-acquisition-public')
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class AcquisitionPublicController {
  constructor(
    private readonly listPublicProducts: ListPublicProductDiscoveryUseCase,
    private readonly getPublicProduct: GetPublicProductPageUseCase,
    private readonly listPlans: ListPlanPresentationsUseCase,
    private readonly getPublicForm: GetPublicFormBySlugUseCase,
    private readonly getPublicCheckout: GetPublicCheckoutSessionUseCase,
    private readonly issueChallenge: IssueAcquisitionChallengeUseCase,
    private readonly captureLead: CaptureAcquisitionLeadUseCase,
    private readonly recordAnalytics: RecordAnalyticsEventUseCase,
  ) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/products')
  @ApiOperation({ summary: 'Public product discovery (CommercialAvailability filtered)' })
  async publicProducts(@Query() query: AcquisitionListQueryDto) {
    return this.listPublicProducts.execute(query);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/products/:slug')
  async publicProductBySlug(@Param('slug') slug: string) {
    return this.getPublicProduct.execute({ slug });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/plans')
  async publicPlans(@Query() query: PublicPlansQueryDto) {
    return this.listPlans.execute({
      productPresentationId: query.productPresentationId,
      status: 'PUBLISHED',
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/forms/:publicSlug')
  async publicForm(@Param('publicSlug') publicSlug: string) {
    return this.getPublicForm.execute({ publicSlug });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/checkout/:id')
  @ApiOperation({ summary: 'Public checkout status projection (no payment credentials)' })
  async publicCheckout(@Param('id') id: string) {
    return this.getPublicCheckout.execute({ id });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/challenge')
  @ApiOperation({
    summary: 'Issue signed math CAPTCHA challenge for public lead capture',
  })
  async publicChallenge() {
    const issued = this.issueChallenge.execute();
    return {
      challengeId: issued.challengeId,
      challengeToken: issued.challengeToken,
      issuedAt: issued.issuedAt.toISOString(),
      expiresAt: issued.expiresAt.toISOString(),
      operandA: issued.operandA,
      operandB: issued.operandB,
      prompt: `Combien font ${issued.operandA} + ${issued.operandB} ?`,
    };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('edge/acquisition/public/leads')
  @ApiOperation({ summary: 'Public lead capture (rate-limited + signed challenge)' })
  async publicCaptureLead(@Body() body: CaptureLeadDto) {
    return this.captureLead.execute({
      actorId: 'public-acquisition',
      ...body,
      honeypot: body.honeypot,
      submittedAtMs: body.submittedAtMs,
      challengeId: body.challengeId,
      challengeToken: body.challengeToken,
      challengeAnswer: body.challengeAnswer,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('edge/acquisition/public/analytics/events')
  async publicAnalytics(@Body() body: RecordAnalyticsDto) {
    return this.recordAnalytics.execute({
      actorId: 'public-acquisition',
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
}
