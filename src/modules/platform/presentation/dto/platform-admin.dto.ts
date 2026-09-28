import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';
import { TenantStatus } from '../../../identity/domain/tenant/tenant.entity.js';

export class ProvisionTenantDto {
  @ApiProperty({ example: 'pharma-group', description: 'Unique tenant slug' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with optional hyphens',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'eu-west-1' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'production' })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional({ description: 'PostgreSQL database name for tenant pool' })
  @IsOptional()
  @IsString()
  @MaxLength(63)
  databaseName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  databaseHost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  databasePort?: number;

  @ApiPropertyOptional({
    description: 'Secret reference (env: TENANT_DB_PASSWORD). Defaults to TENANT_DB_PASSWORD.',
  })
  @IsOptional()
  @IsString()
  credentialsReference?: string;

  @ApiPropertyOptional({ description: 'Initial tenant owner Keycloak subject id' })
  @IsOptional()
  @IsString()
  ownerIdentityId?: string;

  @ApiPropertyOptional({
    description:
      'Create a default Keycloak Organization in the shared realm and mirror it in the control plane (default true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  bootstrapOrganization?: boolean;

  @ApiPropertyOptional({ description: 'Display name for the default organization' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultOrganizationName?: string;

  @ApiPropertyOptional({ description: 'Slug/alias for the default Keycloak Organization' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'defaultOrganizationSlug must be lowercase alphanumeric with optional hyphens',
  })
  defaultOrganizationSlug?: string;
}

export class PlatformTransitionTenantStatusDto {
  @ApiProperty({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}
