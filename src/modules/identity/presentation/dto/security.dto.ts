import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSecurityPoliciesDto {
  @ApiPropertyOptional({ example: 'required_for_admins' })
  @IsOptional()
  @IsString()
  mfaPolicy?: string;

  @ApiPropertyOptional({ type: [String], example: ['totp', 'webauthn'] })
  @IsOptional()
  @IsArray()
  mfaMethods?: string[];

  @ApiPropertyOptional({ example: 480 })
  @IsOptional()
  @IsNumber()
  sessionLifetimeMinutes?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  idleTimeoutMinutes?: number;

  @ApiPropertyOptional({ example: 1440 })
  @IsOptional()
  @IsNumber()
  maxSessionDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sessionConcurrency?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  failedLoginThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accountLockoutMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  passwordMinLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireUpper?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireSymbol?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  ipAllowlist?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  ipDenylist?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  countryRestrictions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  suspiciousLoginDetection?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  ssoProviders?: string[];

  @ApiPropertyOptional({ description: 'Additional security policy keys' })
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}

export class RevokeSessionDto {
  @ApiProperty({ description: 'Keycloak session ID' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiPropertyOptional({
    description: 'Also denylist the caller JWT (logout current device)',
    default: false,
  })
  @IsOptional()
  denylistCallerToken?: boolean;
}

export class CreateIdentityProviderDto {
  @ApiProperty({ example: 'google' })
  @IsString()
  @IsNotEmpty()
  alias!: string;

  @ApiProperty({
    example: 'google',
    description: 'Keycloak provider id: google, microsoft, github, oidc, saml, …',
  })
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @ApiPropertyOptional({ example: 'Google' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  linkOnly?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      clientId: '…',
      clientSecret: '…',
      defaultScope: 'openid email profile',
    },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, string>;
}

export class UpdateIdentityProviderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  linkOnly?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Merged into existing config; empty secret keeps previous value',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, string>;
}
