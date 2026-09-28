import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class GrantDelegationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiProperty()
  @IsString()
  granteeIdentityId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @ApiPropertyOptional({ description: 'Expiry in hours (max 720)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours?: number;
}

export class GrantEmergencyAccessDto {
  @ApiProperty()
  @IsString()
  operatorIdentityId!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  reason!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Expiry in hours (max 24)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  expiresInHours?: number;
}
