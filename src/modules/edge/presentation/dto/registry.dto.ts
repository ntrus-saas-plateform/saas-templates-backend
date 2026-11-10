import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** OpenAPI request bodies for P7.2 registry APIs (documentation + contract clarity). */

export class RegisterProductDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  verticalCategory?: string;
}

export class PatchWithVersionDto {
  @ApiProperty({ description: 'Optimistic concurrency version' })
  expectedVersion!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  patch!: Record<string, unknown>;
}

export class TransitionStatusDto {
  @ApiProperty({
    description: 'Target lifecycle / operational / contract status',
    example: 'CERTIFIED',
  })
  toStatus!: string;

  @ApiPropertyOptional({
    description: 'Mandatory for suspend/deprecate/retire sensitive transitions',
  })
  reason?: string;
}

export class CreateTechnicalVersionDto {
  @ApiProperty({ example: '1.2.0' })
  technicalVersion!: string;

  @ApiPropertyOptional({
    enum: ['DEV', 'BETA', 'STABLE', 'LTS', 'HOTFIX'],
    default: 'STABLE',
  })
  releaseChannel?: string;

  @ApiPropertyOptional()
  changeSummary?: string;
}

export class RegisterPlatformDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({
    enum: [
      'SHARED_SAAS_PLATFORM',
      'DEDICATED_PLATFORM',
      'PRIVATE_PLATFORM',
      'ON_PREMISE_PLATFORM',
    ],
  })
  platformType!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  businessBackendId?: string;

  @ApiPropertyOptional({ type: [String] })
  allowedProductIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  supportedEnvironmentTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  supportedProfileCodes?: string[];

  @ApiPropertyOptional()
  connectivityReference?: string;

  @ApiPropertyOptional({
    description: 'Opaque secure config handle — never a plaintext secret',
  })
  secureConfigRef?: string;
}

export class RegisterEnvironmentDto {
  @ApiProperty({ format: 'uuid' })
  platformId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION'] })
  environmentType!: string;

  @ApiPropertyOptional()
  region?: string;

  @ApiPropertyOptional()
  geoZone?: string;

  @ApiPropertyOptional()
  securityClassification?: string;

  @ApiPropertyOptional()
  dataClassification?: string;

  @ApiPropertyOptional({ type: [String] })
  allowedProfileCodes?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  dataResidencyConstraints?: Record<string, unknown>;
}

export class CreateControlContractDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  platformId!: string;

  @ApiProperty()
  contractCode!: string;

  @ApiProperty()
  contractVersion!: string;

  @ApiProperty()
  schemaVersion!: string;

  @ApiProperty()
  connectivityModel!: string;

  @ApiPropertyOptional({ type: 'array' })
  supportedCapabilities?: unknown[];

  @ApiPropertyOptional({ type: 'array' })
  supportedControlOperations?: unknown[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Secrets in this object are redacted server-side',
  })
  s2sAuthPolicy?: Record<string, unknown>;
}

export class EvaluateCompatibilityDto {
  @ApiProperty({ format: 'uuid' })
  productRegistryId!: string;

  @ApiProperty({ format: 'uuid' })
  technicalVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  platformId!: string;

  @ApiProperty({ format: 'uuid' })
  environmentId!: string;

  @ApiProperty({ format: 'uuid' })
  profileId!: string;

  @ApiProperty({ format: 'uuid' })
  contractId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  correlationId?: string;
}
