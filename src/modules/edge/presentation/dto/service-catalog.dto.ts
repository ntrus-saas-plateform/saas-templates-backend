import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ServiceCatalogSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lifecycleStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observationStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationalTeam?: string;

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
}

export class RegisterPlatformServiceDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  serviceCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lifecycleStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observationStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessCriticality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicalCriticality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationalTeam?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceOwnerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicalOwnerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class UpdatePlatformServiceDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lifecycleStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observationStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessCriticality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicalCriticality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationalTeam?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceOwnerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicalOwnerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  healthCheckRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class AddServiceDependencyDto {
  @ApiProperty()
  @IsUUID()
  dependsOnServiceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dependencyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  criticality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RemoveServiceDependencyQueryDto {
  @ApiProperty()
  @IsUUID()
  dependsOnServiceId!: string;

  @ApiProperty({ default: 'RUNTIME' })
  @IsString()
  dependencyType!: string;
}
