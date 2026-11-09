import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, IS_CUSTOMER_ROUTE_KEY, IS_EDGE_ROUTE_KEY } from './decorators.js';
import { JwtValidationService } from './jwt-validation.service.js';
import { ActiveOrganizationResolver } from './active-organization.resolver.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { IdentityMetricsService } from '../observability/identity-metrics.service.js';
import { TokenIntrospectionService } from '../keycloak/token-introspection.service.js';
import { APPLICATION_USER_REPOSITORY_PORT } from '../../modules/identity/domain/ports/application-user-repository.port.js';
import type { ApplicationUserRepositoryPort } from '../../modules/identity/domain/ports/application-user-repository.port.js';
import { isApplicationUserAccessible } from '../../modules/identity/domain/user/application-user.entity.js';
import { TOKEN_REVOCATION_PORT } from '../../core/domain/ports/token-revocation.port.js';
import type { TokenRevocationPort } from '../../core/domain/ports/token-revocation.port.js';
import { MfaEnforcementService } from './mfa-enforcement.service.js';
import { PatValidationService } from './pat-validation.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtValidation: JwtValidationService,
    private readonly activeOrganizationResolver: ActiveOrganizationResolver,
    private readonly tenantContext: TenantContextService,
    private readonly identityMetrics: IdentityMetricsService,
    private readonly tokenIntrospection: TokenIntrospectionService,
    private readonly mfaEnforcement: MfaEnforcementService,
    private readonly patValidation: PatValidationService,
    @Inject(APPLICATION_USER_REPOSITORY_PORT)
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    @Inject(TOKEN_REVOCATION_PORT)
    private readonly tokenRevocation: TokenRevocationPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isCustomerRoute = this.reflector.getAllAndOverride<boolean>(IS_CUSTOMER_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isCustomerRoute) return true;

    const isEdgeRoute = this.reflector.getAllAndOverride<boolean>(IS_EDGE_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isEdgeRoute) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      if (this.patValidation.isPersonalApiToken(token)) {
        return this.activatePat(request, token);
      }

      if (this.tokenIntrospection.isEnabled()) {
        const introspection = await this.tokenIntrospection.introspect(token);
        if (!introspection.active) {
          this.identityMetrics.recordLoginFailure('revoked_token');
          throw new UnauthorizedException('Token is not active');
        }
      }

      const user = await this.jwtValidation.validateToken(token);

      if (
        await this.tokenRevocation.isRevoked(user.subjectId, user.tokenIssuedAt, user.tokenId)
      ) {
        this.identityMetrics.recordLoginFailure('revoked_token');
        throw new UnauthorizedException('Token has been revoked');
      }

      const organizationId = await this.activeOrganizationResolver.resolve(user);

      const applicationUser = await this.applicationUserRepository.findByIdentity(
        user.tenantId,
        user.subjectId,
      );
      if (applicationUser && !isApplicationUserAccessible(applicationUser.status)) {
        this.identityMetrics.recordLoginFailure('user_not_accessible');
        throw new UnauthorizedException('User account is not active');
      }

      await this.mfaEnforcement.assertLoginMfaCompliance(user, context);

      (request as Request & { user: unknown }).user = user;

      this.tenantContext.set({
        authKind: 'staff',
        subjectId: user.subjectId,
        userId: user.userId,
        username: user.username,
        email: user.email,
        tenantId: user.tenantId,
        organizationId,
        roles: user.roles,
        permissions: user.permissions,
        clientId: user.clientId,
        locale: user.locale,
        timezone: user.timezone,
        authenticationAcr: user.authenticationAcr,
        authenticationMethods: user.authenticationMethods,
        tokenIssuedAt: user.tokenIssuedAt,
        tokenId: user.tokenId,
        globalCustomerId: null,
        tenantCustomerId: null,
      });

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.identityMetrics.recordLoginFailure('invalid_token');
      if (process.env.NODE_ENV !== 'production') {
        const reason = error instanceof Error ? error.message : String(error);
        // Helps diagnose JWKS/audience/tenant_id/DB failures that are otherwise masked.
        console.warn(`[AuthGuard] token rejected: ${reason}`);
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async activatePat(request: Request, token: string): Promise<boolean> {
    const principal = await this.patValidation.validate(token, request);
    (request as Request & { user: unknown }).user = {
      subjectId: principal.subjectId,
      userId: principal.userId,
      username: principal.username,
      tenantId: principal.tenantId,
      authKind: 'pat',
    };

    this.tenantContext.set({
      authKind: 'pat',
      subjectId: principal.subjectId,
      userId: principal.userId,
      username: principal.username,
      email: principal.username?.includes('@') ? principal.username : null,
      tenantId: principal.tenantId,
      organizationId: principal.organizationId,
      roles: [],
      permissions: [...principal.scopes],
      clientId: 'personal-api-token',
      locale: 'en',
      timezone: 'UTC',
      authenticationAcr: null,
      authenticationMethods: ['pat'],
      tokenIssuedAt: null,
      tokenId: principal.tokenId,
      globalCustomerId: null,
      tenantCustomerId: null,
    });

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
  }
}
