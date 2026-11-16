import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConnectivityAgentPaginationQueryDto {
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
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateConnectivityAgentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  agentCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @ApiProperty({ description: 'Vault-only ref (vault:… or sec_…) — no plaintext keys' })
  @IsString()
  @IsNotEmpty()
  publicKeyRef!: string;

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
  deploymentProfileCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateRef?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Must be true (outbound-only). False is rejected.',
  })
  @IsOptional()
  @IsBoolean()
  outboundOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  provisioningRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  authorizationRowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorizationVersion?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RequestConnectivityAgentRegisterDto {
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
  @IsUUID()
  provisioningRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RequestConnectivityAgentCommandDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  commandType!: string;

  @ApiProperty({ description: '64-char hex nonce (anti-replay)' })
  @IsString()
  @Length(64, 64)
  @Matches(/^[A-Fa-f0-9]{64}$/)
  nonce!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payloadRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatureRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiresAt?: string;

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
  @IsUUID()
  provisioningRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  authorizationRowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorizationVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RequestConnectivityAgentRevokeDto {
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
  @IsUUID()
  provisioningRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
