/**
 * P7.5 Product Control request DTOs.
 * Global ValidationPipe: whitelist + forbidNonWhitelisted + transform.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ControlExchangeStatus,
  ProductControlAuthProfile,
  ProductControlEndpointStatus,
} from '../../domain/product-control/product-control.types.js';

export class ProductControlPaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  platformId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  endpointId?: string;
}

export class RegisterProductControlEndpointDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productRegistryId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  platformId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  environmentId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  code!: string;

  @ApiProperty({ example: 'https://pc.example.com/v1' })
  @IsUrl({ require_tld: false, protocols: ['https'] })
  baseUrl!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  contractVersion!: string;

  @ApiProperty({ enum: ProductControlAuthProfile })
  @IsEnum(ProductControlAuthProfile)
  authProfile!: ProductControlAuthProfile;

  @ApiProperty({ description: 'Opaque credential_ref — never a plaintext secret' })
  @IsString()
  @MinLength(3)
  @MaxLength(512)
  credentialRef!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  allowedScopes?: unknown[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  correlationId?: string;
}

export class QuarantineProductControlEndpointDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  correlationId?: string;
}

export class ProductControlActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  correlationId?: string;
}

export class ReconcileProductControlExchangeDto {
  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED'] })
  @IsEnum({ SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED' })
  outcome!: 'SUCCEEDED' | 'FAILED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  correlationId?: string;
}

export class ReceiveProductControlCallbackDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  callbackId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idempotencyKey!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  signatureAlg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issuedAt?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  requestId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  exchangeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  correlationId?: string;
}

export class ProductControlEndpointStatusFilterDto {
  @ApiPropertyOptional({ enum: ProductControlEndpointStatus })
  @IsOptional()
  @IsEnum(ProductControlEndpointStatus)
  status?: ProductControlEndpointStatus;
}

export class ProductControlExchangeStatusFilterDto {
  @ApiPropertyOptional({ enum: ControlExchangeStatus })
  @IsOptional()
  @IsEnum(ControlExchangeStatus)
  status?: ControlExchangeStatus;
}
