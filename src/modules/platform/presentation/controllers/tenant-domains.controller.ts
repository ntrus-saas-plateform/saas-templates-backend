import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RequireRoles } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiCreatedDataResponse, ApiOkDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { DOMAIN_REGISTRY_PORT } from '../../../identity/domain/ports/domain-registry.port.js';
import type { DomainRegistryPort } from '../../../identity/domain/ports/domain-registry.port.js';
import { DomainType } from '../../../identity/domain/domain/tenant-domain.entity.js';
import type { TenantDomain } from '../../../identity/domain/domain/tenant-domain.entity.js';
import { PlatformAdminAuditService } from '../../application/admin/platform-admin-audit.service.js';

export class CreateTenantDomainDto {
  @ApiProperty({ example: 'acme.example.com', description: 'Fully-qualified hostname to register' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  hostname!: string;

  @ApiPropertyOptional({ enum: DomainType, default: DomainType.CUSTOM })
  @IsOptional()
  @IsEnum(DomainType)
  type?: DomainType;
}

export class VerifyDomainTokenDto {
  @ApiProperty({ description: 'Verification token returned by /verify/start' })
  @IsString()
  @MinLength(1)
  token!: string;
}

export class TenantDomainResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  hostname!: string;

  @ApiProperty({ enum: DomainType })
  type!: DomainType;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  verificationToken?: string | null;

  @ApiProperty()
  verificationMethod!: string;

  @ApiPropertyOptional()
  verifiedAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class VerifyStartResponseDto {
  @ApiProperty({ description: 'DNS TXT record name to create' })
  txtName!: string;

  @ApiProperty({ description: 'Value to place in the TXT record' })
  token!: string;

  @ApiProperty({ description: 'Instruction text' })
  instructions!: string;
}

function mapDomain(d: TenantDomain): TenantDomainResponseDto {
  return {
    id: d.id,
    tenantId: d.tenantId,
    hostname: d.hostname,
    type: d.type,
    isPrimary: d.isPrimary,
    status: d.status,
    verificationToken: d.verificationToken,
    verificationMethod: d.verificationMethod,
    verifiedAt: d.verifiedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

@ApiTags(SwaggerTags.ADMIN)
@ApiBearerAuth()
@RequireRoles('platform-admin')
@Controller('admin/tenants/:tenantId/domains')
export class TenantDomainsController {
  constructor(
    @Inject(DOMAIN_REGISTRY_PORT) private readonly domainRegistry: DomainRegistryPort,
    private readonly tenantContext: TenantContextService,
    private readonly auditService: PlatformAdminAuditService,
  ) {}

  private auditCtx(req: Request, tenantId: string) {
    const ctx = this.tenantContext.getOrThrow();
    return {
      actorIdentityId: ctx.userId ?? undefined,
      actorClientId: ctx.clientId ?? undefined,
      requestId: ctx.requestId || ((req.headers['x-request-id'] as string | undefined) ?? undefined),
      ip: req.ip ?? undefined,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? undefined,
      tenantId,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all registered domains for a tenant' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiOkDataResponse(TenantDomainResponseDto)
  async list(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const domains = await this.domainRegistry.listByTenant(tenantId);
    return { data: domains.map(mapDomain) };
  }

  @Post()
  @ApiOperation({ summary: 'Register a hostname for a tenant (SUBDOMAIN: ACTIVE, CUSTOM: PENDING verification)' })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiJsonBody(CreateTenantDomainDto)
  @ApiCreatedDataResponse(TenantDomainResponseDto)
  async create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateTenantDomainDto,
    @Req() req: Request,
  ) {
    const domain = await this.domainRegistry.create({
      tenantId,
      hostname: dto.hostname.toLowerCase().trim(),
      type: dto.type ?? DomainType.CUSTOM,
    });
    await this.auditService.record({
      ...this.auditCtx(req, tenantId),
      action: 'tenant.domain.create',
      resourceType: 'domain',
      resourceId: domain.id,
      result: 'success',
      metadata: { hostname: domain.hostname, type: domain.type, status: domain.status },
    });
    return { data: mapDomain(domain) };
  }

  @Post(':domainId/verify/start')
  @ApiOperation({
    summary: 'Begin DNS TXT verification for a custom domain',
    description:
      'Generates a verification token and returns the DNS TXT record name and value to set. ' +
      'Record name: `_platform-verify.{hostname}`, value: the returned token. ' +
      'Once the record is in DNS, call POST :domainId/verify/check with the token.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiParam({ name: 'domainId', format: 'uuid' })
  @ApiCreatedDataResponse(VerifyStartResponseDto)
  async verifyStart(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    const { token, txtName } = await this.domainRegistry.beginVerification(domainId, tenantId);
    await this.auditService.record({
      ...this.auditCtx(req, tenantId),
      action: 'tenant.domain.verify.start',
      resourceType: 'domain',
      resourceId: domainId,
      result: 'success',
    });
    return {
      data: {
        txtName,
        token,
        instructions: `Create a DNS TXT record: ${txtName} = "${token}", then call POST verify/check with { "token": "${token}" }`,
      },
    };
  }

  @Post(':domainId/verify/check')
  @ApiOperation({
    summary: 'Confirm domain ownership via DNS TXT + verification token',
    description:
      'Requires the token from verify/start AND a matching DNS TXT record at `_platform-verify.{hostname}`. ' +
      'Marks the domain ACTIVE when both succeed.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiParam({ name: 'domainId', format: 'uuid' })
  @ApiJsonBody(VerifyDomainTokenDto)
  @ApiOkDataResponse(TenantDomainResponseDto)
  async verifyCheck(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Body() dto: VerifyDomainTokenDto,
    @Req() req: Request,
  ) {
    const domain = await this.domainRegistry.markVerified(domainId, tenantId, dto.token);
    await this.auditService.record({
      ...this.auditCtx(req, tenantId),
      action: 'tenant.domain.verify.check',
      resourceType: 'domain',
      resourceId: domainId,
      result: 'success',
      metadata: { hostname: domain.hostname },
    });
    return { data: mapDomain(domain) };
  }
}
