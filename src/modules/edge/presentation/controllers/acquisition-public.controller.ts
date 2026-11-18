import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
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
  ListPublicSegmentPresentationsUseCase,
  PublicCreateCheckoutUseCase,
  PublicSubmitApplicationUseCase,
} from '../../application/acquisition/public-acquire.use-cases.js';
import { GetCommercialCatalogViewUseCase } from '../../application/commercial/commercial.use-cases.js';
import { AcquisitionPublicRateLimiter } from '../../infrastructure/acquisition/acquisition-rate-limiter.js';
import type { SubmittedConsent } from '../../domain/marketing/marketing-consent.js';
import {
  AcquisitionListQueryDto,
  CaptureLeadDto,
  PublicCreateCheckoutDto,
  PublicPlansQueryDto,
  PublicSubmitApplicationDto,
  RecordAnalyticsDto,
} from '../dto/acquisition.dto.js';

const WINDOW_MS = 60_000;

/** Resolve client IP for public abuse keys — never trust XFF unless explicitly enabled. */
export function resolveAcquisitionPublicClientIp(req: Request): string {
  const trustProxy = process.env.ACQUISITION_TRUST_PROXY === 'true';
  const socketIp =
    typeof req.socket?.remoteAddress === 'string' ? req.socket.remoteAddress : undefined;
  const nestIp = typeof req.ip === 'string' && req.ip.trim() ? req.ip.trim() : undefined;

  if (trustProxy) {
    const xffRaw = req.headers['x-forwarded-for'];
    const xff =
      typeof xffRaw === 'string'
        ? xffRaw.split(',')[0]?.trim()
        : Array.isArray(xffRaw)
          ? xffRaw[0]?.split(',')[0]?.trim()
          : undefined;
    if (xff) return xff;
  }

  return nestIp || socketIp || 'unknown';
}

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
    private readonly rateLimiter: AcquisitionPublicRateLimiter,
    private readonly publicSubmitApplication: PublicSubmitApplicationUseCase,
    private readonly publicCreateCheckout: PublicCreateCheckoutUseCase,
    private readonly listPublicSegments: ListPublicSegmentPresentationsUseCase,
    private readonly catalogView: GetCommercialCatalogViewUseCase,
  ) {}

  private async guard(
    req: Request,
    res: Response,
    route: string,
    limit: number,
  ): Promise<void> {
    const clientIp = resolveAcquisitionPublicClientIp(req);
    const key = `acq:public:${route}:${clientIp}`;
    const { mode } = await this.rateLimiter.assertAllowed(key, limit, WINDOW_MS);
    res.setHeader('X-RateLimit-Mode', mode);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/products')
  @ApiOperation({ summary: 'Public product discovery (CommercialAvailability filtered)' })
  async publicProducts(
    @Query() query: AcquisitionListQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'products', 60);
    return this.listPublicProducts.execute(query);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/products/:slug')
  async publicProductBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'products-slug', 60);
    return this.getPublicProduct.execute({ slug });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/plans')
  async publicPlans(
    @Query() query: PublicPlansQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'plans', 60);
    return this.listPlans.execute({
      productPresentationId: query.productPresentationId,
      status: 'PUBLISHED',
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/segments')
  @ApiOperation({ summary: 'Public published segment presentations' })
  async publicSegments(
    @Query() query: AcquisitionListQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'segments', 60);
    return this.listPublicSegments.execute({
      productId: query.productId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/catalog')
  @ApiOperation({ summary: 'Public PUBLISHED commercial catalog (plans/packages/addons)' })
  async publicCatalog(
    @Query('productId') productId: string | undefined,
    @Query('verticalId') verticalId: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'catalog', 60);
    return {
      data: await this.catalogView.execute({
        view: 'PUBLISHED',
        productId: productId?.trim() || undefined,
        verticalId: verticalId?.trim() || undefined,
      }),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/forms/:publicSlug')
  async publicForm(
    @Param('publicSlug') publicSlug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'forms', 60);
    return this.getPublicForm.execute({ publicSlug });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/checkout/:id')
  @ApiOperation({ summary: 'Public checkout status projection (no payment credentials)' })
  async publicCheckout(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'checkout', 60);
    return this.getPublicCheckout.execute({ id });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('edge/acquisition/public/checkout')
  @ApiOperation({ summary: 'Create public checkout session (challenge + published plan)' })
  async publicCreateCheckoutSession(
    @Body() body: PublicCreateCheckoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'checkout-create', 20);
    return this.publicCreateCheckout.execute({
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('edge/acquisition/public/applications')
  @ApiOperation({
    summary: 'Public application: lead → prospect → draft/answers/submit (challenge required)',
  })
  async publicApplication(
    @Body() body: PublicSubmitApplicationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'applications', 20);
    return this.publicSubmitApplication.execute({
      ...body,
      consents: body.consents as SubmittedConsent[] | undefined,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('edge/acquisition/public/challenge')
  @ApiOperation({
    summary: 'Issue signed math CAPTCHA challenge for public lead capture',
  })
  async publicChallenge(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'challenge', 60);
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
  async publicCaptureLead(
    @Body() body: CaptureLeadDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'leads', 20);
    return this.captureLead.execute({
      actorId: 'public-acquisition',
      ...body,
      honeypot: body.honeypot,
      submittedAtMs: body.submittedAtMs,
      challengeId: body.challengeId,
      challengeToken: body.challengeToken,
      challengeAnswer: body.challengeAnswer,
      consents: body.consents,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('edge/acquisition/public/analytics/events')
  async publicAnalytics(
    @Body() body: RecordAnalyticsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.guard(req, res, 'analytics', 120);
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
