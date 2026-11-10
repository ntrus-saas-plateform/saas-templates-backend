import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InfrastructurePaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional()
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
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engine?: string;
}

export class CreateResourcePlanDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiProperty()
  @IsUUID()
  authorizationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  authorizationVersion?: number;

  @ApiProperty()
  @IsUUID()
  placementDecisionId!: string;

  @ApiProperty()
  @IsUUID()
  reservationId!: string;

  @ApiProperty()
  @IsUUID()
  providerId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  region!: string;

  @ApiProperty({ enum: ['POSTGRESQL', 'MONGODB', 'SURREALDB'] })
  @IsIn(['POSTGRESQL', 'MONGODB', 'SURREALDB'])
  databaseEngine!: 'POSTGRESQL' | 'MONGODB' | 'SURREALDB';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  encryptionPolicy?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  networkRequirements?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  backupPolicy?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  computeRequirements?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  storageRequirements?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deploymentProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class ValidateResourcePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  authorizationValid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  authorizationExpired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  authorizationRevoked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  placementValid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reservationValid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reservationCommitted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class DeprovisionResourceDto {
  @ApiProperty()
  @IsBoolean()
  authorized!: boolean;

  @ApiProperty()
  @IsBoolean()
  confirmed!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class InfrastructureActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  backupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetDatabaseName?: string;
}
