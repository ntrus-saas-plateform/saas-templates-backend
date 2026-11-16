import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class AcquisitionListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productPresentationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string;

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

export class CreateProductPresentationDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class PublishContentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateSegmentPresentationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productPresentationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  targetingRules?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreatePlanPresentationDto {
  @ApiProperty()
  @IsUUID()
  commercialPlanId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  priceDisplayMode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productPresentationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priceDisplayRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyHint?: string | null;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  featuresDisplay?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctaLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateProspectDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialPlanId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planPresentationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceChannel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class TransitionProspectDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  toStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  patch?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CaptureLeadDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sourceType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  formPublicationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marketingLeadSoftRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prospectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  score?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scoreBand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attribution?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Bot trap — leave empty. Non-empty values are rejected server-side.',
  })
  @IsOptional()
  @IsString()
  honeypot?: string;

  @ApiPropertyOptional({
    description: 'Client form-render timestamp (ms). Submissions faster than 800ms are rejected.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  submittedAtMs?: number;

  @ApiPropertyOptional({
    description: 'Public challenge id from GET /edge/acquisition/public/challenge (required on public lead).',
  })
  @IsOptional()
  @IsString()
  challengeId?: string;

  @ApiPropertyOptional({
    description: 'Signed challenge token from GET /edge/acquisition/public/challenge.',
  })
  @IsOptional()
  @IsString()
  challengeToken?: string;

  @ApiPropertyOptional({
    description: 'Math answer String(operandA + operandB) for the issued challenge.',
  })
  @IsOptional()
  @IsString()
  challengeAnswer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class PromoteLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createProspectIfMissing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateFormSchemaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialPlanId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateFormVersionDto {
  @ApiProperty()
  @IsObject()
  schemaDefinition!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  conditionRules?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class PublishFormVersionDto {
  @ApiPropertyOptional({ description: 'Publication channel (e.g. PUBLIC_WEB). Required to create a public publication row.' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: 'Public slug for PUBLIC_WEB publications' })
  @IsOptional()
  @IsString()
  publicSlug?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateApplicationDraftDto {
  @ApiProperty()
  @IsUUID()
  prospectId!: string;

  @ApiProperty()
  @IsUUID()
  formVersionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  formSchemaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  formPublicationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  leadId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialPlanId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planPresentationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class SaveAnswersDto {
  @ApiProperty({ description: 'Map fieldKey→value or array of {fieldKey,value}' })
  answers!: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>;

  @ApiPropertyOptional({ description: 'Optimistic concurrency — must match application.version' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class TransitionApplicationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  toStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionReason?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RequestInformationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingFields?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RegisterDocumentDto {
  @ApiProperty()
  @IsUUID()
  applicationId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  documentType!: string;

  @ApiProperty({ description: 'Private storage key — never a public URL' })
  @IsString()
  @MinLength(1)
  storageKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requirementId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentType?: string | null;

  @ApiPropertyOptional({ description: 'Private locator — defaults to storageKey; never a public URL' })
  @IsOptional()
  @IsString()
  privateLocator?: string | null;

  @ApiPropertyOptional({ description: 'Byte size — required when storage port validates (max 10MB)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  byteSize?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksumSha256?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class ReviewDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  decision!: 'ACCEPTED' | 'REJECTED' | 'NEEDS_RESUBMIT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateDocumentRequirementDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  documentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  formSchemaId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  conditionRules?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class StartQualificationDto {
  @ApiProperty()
  @IsUUID()
  applicationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  criteria?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class DecideQualificationDto {
  @ApiProperty()
  @IsString()
  decision!: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcomeSummary?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateQuoteRequestDto {
  @ApiProperty()
  @IsUUID()
  prospectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialPlanId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planPresentationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class AttachQuoteReferenceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  externalQuoteRef!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  commercialSource!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  displaySummary?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CreateCheckoutDto {
  @ApiProperty()
  @IsUUID()
  prospectId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planPresentationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialPlanId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  quoteReferenceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class AttachPaymentDto {
  @ApiProperty({ description: 'P6 payment intent / billing session reference only' })
  @IsString()
  @MinLength(1)
  paymentIntentRef!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class InitiateAcquisitionPaymentDto {
  @ApiProperty({ description: 'Billing account that owns the P6 payment intent' })
  @IsUUID()
  billingAccountId!: string;

  @ApiProperty({
    description:
      'Authoritative amount from revalidated commercial terms — never frontend-invented without revalidate',
  })
  @IsString()
  @MinLength(1)
  amount!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  currency!: string;

  @ApiPropertyOptional({ description: 'Must not be false when provided' })
  @IsOptional()
  @IsBoolean()
  termsConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RecordPaymentResultDto {
  @ApiProperty({ description: 'Authoritative P6 payment status string' })
  @IsString()
  @MinLength(1)
  p6Status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RevalidatePlanDto {
  @ApiProperty()
  @IsUUID()
  planPresentationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expectedCommercialPlanVersion?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmationAccepted?: boolean;
}

export class RequestHandoffDto {
  @ApiProperty()
  @IsUUID()
  prospectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  checkoutSessionId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  commercialPlanId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class CompleteHandoffDto {
  @ApiProperty({ description: 'P5 subscription id — never invented in P10' })
  @IsString()
  @MinLength(1)
  subscriptionId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  externalEvidenceRef!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class AdvanceJourneyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  toStepKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  contextPatch?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  complete?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class QueueCommunicationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  channel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prospectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  journeyInstanceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class UpdateCommunicationStatusDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class RecordAnalyticsDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  eventName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prospectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  leadId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class FunnelQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prospectId?: string;

  @ApiPropertyOptional({ default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
}

export class PublicPlansQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productPresentationId?: string;

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
