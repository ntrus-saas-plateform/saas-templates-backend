import { Controller, Get, Patch, Post, Body, Query, Param, Delete } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
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
  GetSecurityPoliciesUseCase,
  UpdateSecurityPoliciesUseCase,
  GetMfaStatusUseCase,
  ListSessionsUseCase,
  RevokeSessionUseCase,
  RevokeAllSessionsUseCase,
  LogoutCurrentTokenUseCase,
} from '../../application/security/security.use-cases.js';
import { ListIdentityProvidersUseCase } from '../../application/security/identity.use-cases.js';
import {
  CreateIdentityProviderUseCase,
  UpdateIdentityProviderUseCase,
  DeleteIdentityProviderUseCase,
  GetIdentityProviderUseCase,
} from '../../application/security/identity-providers-phone.use-cases.js';
import {
  UpdateSecurityPoliciesDto,
  RevokeSessionDto,
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
} from '../dto/security.dto.js';
import {
  SecurityPoliciesResponseDto,
  MfaStatusResponseDto,
  SessionsListDataResponseDto,
  SessionRevokeResponseDto,
  LogoutResponseDto,
  RevokeAllSessionsResponseDto,
} from '../dto/identity-response.dto.js';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';

@ApiTags(SwaggerTags.SECURITY)
@ApiBearerAuth()
@Controller('security')
export class SecurityController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly getSecurityPoliciesUseCase: GetSecurityPoliciesUseCase,
    private readonly updateSecurityPoliciesUseCase: UpdateSecurityPoliciesUseCase,
    private readonly getMfaStatusUseCase: GetMfaStatusUseCase,
    private readonly listIdentityProvidersUseCase: ListIdentityProvidersUseCase,
    private readonly getIdentityProviderUseCase: GetIdentityProviderUseCase,
    private readonly createIdentityProviderUseCase: CreateIdentityProviderUseCase,
    private readonly updateIdentityProviderUseCase: UpdateIdentityProviderUseCase,
    private readonly deleteIdentityProviderUseCase: DeleteIdentityProviderUseCase,
  ) {}

  @Get('policies')
  @RequirePermissions('security:read')
  @ApiOperation({ summary: 'Get tenant security policies (MFA, session lifetime)' })
  @ApiOkDataResponse(SecurityPoliciesResponseDto)
  async getPolicies() {
    const policies = await this.getSecurityPoliciesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: policies };
  }

  @Patch('policies')
  @RequirePermissions('security:update')
  @AuditAction('security.policy.update', 'security')
  @ApiOperation({ summary: 'Update tenant security policies' })
  @ApiJsonBody(UpdateSecurityPoliciesDto)
  @ApiOkDataResponse(SecurityPoliciesResponseDto)
  async updatePolicies(@Body() dto: UpdateSecurityPoliciesDto) {
    const { extra, ...rest } = dto;
    const merged: Record<string, unknown> = { ...(extra ?? {}) };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) merged[key] = value;
    }
    const policies = await this.updateSecurityPoliciesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      policies: merged,
    });
    return { data: policies };
  }

  @Get('identity-providers')
  @RequirePermissions('security:read')
  @ApiOperation({
    summary: 'List Keycloak realm identity providers (Google, SAML, OIDC, LDAP, …)',
  })
  async listIdentityProviders() {
    const result = await this.listIdentityProvidersUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return {
      data: {
        providers: result.data,
        keycloakAvailable: result.keycloakAvailable,
      },
    };
  }

  @Get('identity-providers/:alias')
  @RequirePermissions('security:read')
  @ApiParam({ name: 'alias' })
  @ApiOperation({ summary: 'Get one Keycloak identity provider (secrets redacted)' })
  async getIdentityProvider(@Param('alias') alias: string) {
    const data = await this.getIdentityProviderUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      alias,
    });
    return { data };
  }

  @Post('identity-providers')
  @RequirePermissions('security:update')
  @AuditAction('security.identity_provider.create', 'identity_provider')
  @ApiOperation({ summary: 'Create Keycloak realm identity provider' })
  @ApiJsonBody(CreateIdentityProviderDto)
  @ApiCreatedDataResponse(Object)
  async createIdentityProvider(@Body() dto: CreateIdentityProviderDto) {
    const data = await this.createIdentityProviderUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      input: {
        alias: dto.alias,
        providerId: dto.providerId,
        displayName: dto.displayName,
        enabled: dto.enabled,
        linkOnly: dto.linkOnly,
        config: dto.config,
      },
    });
    return { data };
  }

  @Patch('identity-providers/:alias')
  @RequirePermissions('security:update')
  @AuditAction('security.identity_provider.update', 'identity_provider')
  @ApiParam({ name: 'alias' })
  @ApiOperation({ summary: 'Update Keycloak identity provider' })
  @ApiJsonBody(UpdateIdentityProviderDto)
  async updateIdentityProvider(
    @Param('alias') alias: string,
    @Body() dto: UpdateIdentityProviderDto,
  ) {
    const data = await this.updateIdentityProviderUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      input: {
        alias,
        displayName: dto.displayName,
        enabled: dto.enabled,
        linkOnly: dto.linkOnly,
        config: dto.config,
      },
    });
    return { data };
  }

  @Delete('identity-providers/:alias')
  @RequirePermissions('security:update')
  @AuditAction('security.identity_provider.delete', 'identity_provider')
  @ApiParam({ name: 'alias' })
  @ApiOperation({ summary: 'Delete Keycloak identity provider' })
  async deleteIdentityProvider(@Param('alias') alias: string) {
    const data = await this.deleteIdentityProviderUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      alias,
    });
    return { data };
  }

  @Get('mfa/status')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get MFA enrollment status for current user (Keycloak)' })
  @ApiOkDataResponse(MfaStatusResponseDto)
  async getMfaStatus() {
    const status = await this.getMfaStatusUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: status };
  }
}

@ApiTags(SwaggerTags.SECURITY)
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listSessionsUseCase: ListSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly revokeAllSessionsUseCase: RevokeAllSessionsUseCase,
    private readonly logoutCurrentTokenUseCase: LogoutCurrentTokenUseCase,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List current user sessions (Keycloak)' })
  @ApiOkDataResponse(SessionsListDataResponseDto)
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async listSessions(@Query() pagination: PaginationQueryDto) {
    const result = await this.listSessionsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return {
      data: {
        sessions: result.data.map((s) => ({
          id: s.id,
          username: s.username,
          ipAddress: s.ipAddress,
          started: s.started,
          lastAccess: s.lastAccess,
          createdAt: s.started,
          lastAccessedAt: s.lastAccess,
          clients: s.clients,
          browser: s.browser,
          os: s.os,
          device: s.device,
        })),
        keycloakAvailable: result.keycloakAvailable,
      },
      pagination: result.pagination,
    };
  }

  @Post('revoke')
  @RequirePermissions('users:update')
  @AuditAction('session.revoke', 'session')
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiJsonBody(RevokeSessionDto)
  @ApiOkDataResponse(SessionRevokeResponseDto)
  async revokeSession(@Body() dto: RevokeSessionDto) {
    const result = await this.revokeSessionUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      sessionId: dto.sessionId,
      denylistCallerToken: dto.denylistCallerToken,
    });
    return { data: result };
  }

  @Post('logout')
  @RequirePermissions('users:update')
  @AuditAction('session.logout', 'session')
  @ApiOperation({ summary: 'Denylist current JWT (logout without Keycloak session revoke)' })
  @ApiOkDataResponse(LogoutResponseDto)
  async logoutCurrentToken() {
    const result = await this.logoutCurrentTokenUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: result };
  }

  @Post('revoke-all')
  @RequirePermissions('users:update')
  @AuditAction('session.revoke_all', 'session')
  @ApiOperation({ summary: 'Revoke all sessions for current user' })
  @ApiOkDataResponse(RevokeAllSessionsResponseDto)
  async revokeAll() {
    const result = await this.revokeAllSessionsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: result };
  }
}
