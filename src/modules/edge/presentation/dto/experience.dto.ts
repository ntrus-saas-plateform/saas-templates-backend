import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export class ExperiencePaginationQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experienceProfileId?: string;
}

export class CreateExperienceProfileDto {
  @ApiProperty({ example: 'retail-pos' })
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  compatibleRuntimeCodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  compatibleDeploymentProfileCodes?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PublishExperienceProfileDto {
  @ApiProperty({ description: 'Optimistic concurrency version of the profile' })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CreateExperienceApplicationDto {
  @ApiProperty({ example: 'pos-web' })
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

  @ApiProperty({
    example: 'WEB',
    enum: [
      'WEB',
      'MOBILE',
      'DESKTOP',
      'POS',
      'OPERATIONS',
      'CUSTOMER',
      'KIOSK',
      'DISPLAY',
      'DEVICE',
      'OTHER',
    ],
  })
  @IsString()
  @IsNotEmpty()
  applicationKind!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experienceProfileId?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  draftManifest!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  runtimeVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiCompatibilityVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deploymentProfileCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  configurationBundleCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entitlementSnapshotVersion?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PublishExperienceApplicationDto {
  @ApiProperty({ description: 'Optimistic concurrency version of the application' })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  versionNumber?: number;
}

export class AssignTenantExperienceDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experienceProfileId?: string;

  @ApiProperty({
    type: Object,
    description:
      'Desired experience manifest: applications[], clients[] (redirectUris/webOrigins validated), domains[]',
  })
  @IsObject()
  desiredManifest!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RequestExperienceProvisionDto {
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

export class RequestExperienceDeactivateDto {
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

export class CreateExperienceDomainDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  assignmentId!: string;

  @ApiProperty({ example: 'app.tenant.example.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  hostname!: string;

  @ApiPropertyOptional({ enum: ['SUBDOMAIN', 'CUSTOM'] })
  @IsOptional()
  @IsIn(['SUBDOMAIN', 'CUSTOM'])
  domainKind?: 'SUBDOMAIN' | 'CUSTOM';
}
