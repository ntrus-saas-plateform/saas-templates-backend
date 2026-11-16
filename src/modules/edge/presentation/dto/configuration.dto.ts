import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export class ConfigurationPaginationQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;
}

export class CreateConfigurationSchemaDto {
  @ApiProperty({ example: 'runtime-knobs' })
  @IsString()
  @Matches(CODE_RE, { message: 'code must be lowercase alphanumeric with dashes' })
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @ApiProperty({ type: Object })
  @IsObject()
  jsonSchema!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateConfigurationTemplateDto {
  @ApiProperty({ example: 'edge-default' })
  @IsString()
  @Matches(CODE_RE, { message: 'code must be lowercase alphanumeric with dashes' })
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  schemaId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  runtimeProfileCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deploymentProfileCode?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  draftPayload!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PublishConfigurationVersionDto {
  @ApiProperty({ description: 'Optimistic concurrency version of the parent resource' })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  versionNumber?: number;
}

export class ConfigurationTemplateRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  versionNumber!: number;
}

export class CreateConfigurationBundleDto {
  @ApiProperty({ example: 'tenant-baseline' })
  @IsString()
  @Matches(CODE_RE, { message: 'code must be lowercase alphanumeric with dashes' })
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ type: [ConfigurationTemplateRefDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigurationTemplateRefDto)
  templateRefs!: ConfigurationTemplateRefDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencyRefs?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  rolloutPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class GrantedEntitlementsDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  quotas?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;
}

export class AssignTenantConfigurationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'P7.1 provisioning request id (required, fail-closed)' })
  @IsString()
  @IsNotEmpty()
  provisioningRequestId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bundleId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  bundleVersion!: number;

  @ApiProperty({ type: Object })
  @IsObject()
  desiredConfig!: Record<string, unknown>;

  @ApiProperty({
    type: GrantedEntitlementsDto,
    description: 'P5 granted entitlement snapshot — expansion is rejected',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => GrantedEntitlementsDto)
  grantedEntitlements!: GrantedEntitlementsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entitlementSnapshotRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entitlementVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deploymentStrategy?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RequestConfigurationDeploymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provisioningRequestId?: string;
}

export class RequestConfigurationRollbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
