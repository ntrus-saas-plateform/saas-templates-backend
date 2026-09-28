import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiErrorResponseDto } from '../../../../shared/swagger/api-response.dto.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  CreateInvitationUseCase,
  AcceptInvitationUseCase,
  RevokeInvitationUseCase,
  ListInvitationsUseCase,
} from '../../application/invitation/invitation.use-cases.js';
import { CreateInvitationDto, AcceptInvitationDto } from '../dto/invitation.dto.js';
import { ListInvitationsQueryDto } from '../dto/list-invitations-query.dto.js';
import {
  InvitationResponseDto,
  InvitationCreatedResponseDto,
  InvitationAcceptResponseDto,
} from '../dto/identity-response.dto.js';
import { IdentityMetricsService } from '../../../../shared/observability/identity-metrics.service.js';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';

@ApiTags(SwaggerTags.INVITATIONS)
@ApiBearerAuth()
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly createInvitationUseCase: CreateInvitationUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    private readonly revokeInvitationUseCase: RevokeInvitationUseCase,
    private readonly listInvitationsUseCase: ListInvitationsUseCase,
    private readonly identityMetrics: IdentityMetricsService,
  ) {}

  @Get()
  @RequirePermissions('users:invite')
  @ApiOperation({ summary: 'List invitations (paginated)' })
  @ApiQuery({ name: 'organizationId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOkDataResponse(InvitationResponseDto, true)
  async list(@Query() query: ListInvitationsQueryDto) {
    const result = await this.listInvitationsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId: query.organizationId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Post()
  @RequirePermissions('users:invite')
  @AuditAction('invitation.create', 'invitation')
  @ApiOperation({
    summary: 'Create invitation',
    description:
      'Returns a single-use token in the response (not stored in plain text). Also attempts email delivery via SMTP or Resend when configured; create still succeeds if send fails.',
  })
  @ApiJsonBody(CreateInvitationDto)
  @ApiCreatedDataResponse(InvitationCreatedResponseDto)
  async create(@Body() dto: CreateInvitationDto) {
    const { invitation, token, emailDelivery } = await this.createInvitationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId: dto.organizationId,
      email: dto.email,
      roles: dto.roles,
      permissions: dto.permissions,
      expiresInHours: dto.expiresInHours,
    });
    return {
      data: {
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organizationId,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        token,
        emailSent: emailDelivery.sent,
        emailProvider: emailDelivery.provider,
        emailError: emailDelivery.error ?? null,
      },
    };
  }

  @Post('accept')
  @AuditAction('invitation.accept', 'invitation')
  @ApiOperation({
    summary: 'Accept invitation with token (authenticated user)',
    description:
      'Requires a logged-in user whose email matches the invitation. No extra permission — invitees may not have users:read yet.',
  })
  @ApiJsonBody(AcceptInvitationDto)
  @ApiOkDataResponse(InvitationAcceptResponseDto)
  @ApiResponse({ status: 403, type: ApiErrorResponseDto })
  async accept(@Body() dto: AcceptInvitationDto) {
    try {
      const result = await this.acceptInvitationUseCase.execute({
        ctx: toExecutionContext(this.tenantContext.getOrThrow()),
        token: dto.token,
      });
      return { data: result };
    } catch (error) {
      const reason =
        error instanceof DomainError ? error.code : 'accept_failed';
      this.identityMetrics.recordInvitationFailure(reason);
      throw error;
    }
  }

  @Post(':invitationId/revoke')
  @RequirePermissions('users:invite')
  @AuditAction('invitation.revoke', 'invitation')
  @ApiOperation({ summary: 'Revoke pending invitation' })
  @ApiParam({ name: 'invitationId', format: 'uuid' })
  @ApiOkDataResponse(InvitationResponseDto)
  async revoke(@Param('invitationId', ParseUUIDPipe) invitationId: string) {
    const invitation = await this.revokeInvitationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      invitationId,
    });
    return { data: invitation };
  }
}
