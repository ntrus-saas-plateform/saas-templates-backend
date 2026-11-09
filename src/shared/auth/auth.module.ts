import { Global, Module, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { TenantGuard } from './tenant.guard.js';
import { TenantHostGuard } from './tenant-host.guard.js';
import { TenantWritableGuard } from './tenant-writable.guard.js';
import { OrganizationGuard } from './organization.guard.js';
import { PermissionGuard } from './permission.guard.js';
import { ModuleGuard } from './module.guard.js';
import { StepUpGuard } from './step-up.guard.js';
import { JwtValidationService } from './jwt-validation.service.js';
import { EdgeJwtValidationService } from './edge-jwt-validation.service.js';
import { EdgeContextService } from './edge-context.service.js';
import { EdgeAuthGuard } from './edge-auth.guard.js';
import { EdgePermissionGuard } from './edge-permission.guard.js';
import { EdgeWorkspaceGuard } from './edge-workspace.guard.js';
import { EdgeOptionalWorkspaceGuard } from './edge-optional-workspace.guard.js';
import { ActiveOrganizationResolver } from './active-organization.resolver.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CacheModule } from '../database/cache.module.js';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { TokenDenylistService, tokenRevocationProvider } from './token-denylist.service.js';
import { TOKEN_REVOCATION_PORT } from '../../core/domain/ports/token-revocation.port.js';
import { MfaEnforcementService } from './mfa-enforcement.service.js';
import { PatValidationService } from './pat-validation.service.js';
import { IdentityPersistenceModule } from '../../modules/identity/infrastructure/persistence/identity-persistence.module.js';
import { EdgePersistenceModule } from '../../modules/edge/infrastructure/persistence/edge-persistence.module.js';

@Global()
@Module({
  imports: [
    AuthorizationModule,
    CacheModule,
    ConfigurationModule,
    IdentityPersistenceModule,
    forwardRef(() => EdgePersistenceModule),
  ],
  providers: [
    Reflector,
    JwtValidationService,
    EdgeJwtValidationService,
    EdgeContextService,
    EdgeAuthGuard,
    EdgePermissionGuard,
    EdgeWorkspaceGuard,
    EdgeOptionalWorkspaceGuard,
    ActiveOrganizationResolver,
    TokenDenylistService,
    tokenRevocationProvider,
    MfaEnforcementService,
    PatValidationService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantHostGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: TenantWritableGuard },
    { provide: APP_GUARD, useClass: OrganizationGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
    { provide: APP_GUARD, useClass: StepUpGuard },
  ],
  exports: [
    JwtValidationService,
    EdgeJwtValidationService,
    EdgeContextService,
    EdgeAuthGuard,
    EdgePermissionGuard,
    EdgeWorkspaceGuard,
    EdgeOptionalWorkspaceGuard,
    ActiveOrganizationResolver,
    TOKEN_REVOCATION_PORT,
    PatValidationService,
  ],
})
export class AuthModule {}
