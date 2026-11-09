export enum CompatibilityTargetType {
  SEGMENT = 'SEGMENT',
  PROFILE = 'PROFILE',
  OPERATING_MODEL = 'OPERATING_MODEL',
}

export enum CompatibilityStatus {
  NOT_ASSESSED = 'NOT_ASSESSED',
  COMPATIBLE = 'COMPATIBLE',
  COMPATIBLE_WITH_RESTRICTIONS = 'COMPATIBLE_WITH_RESTRICTIONS',
  INCOMPATIBLE = 'INCOMPATIBLE',
  UNDER_VALIDATION = 'UNDER_VALIDATION',
  DEPRECATED = 'DEPRECATED',
}

export interface ProductCompatibility {
  readonly id: string;
  readonly productId: string;
  readonly productVersionId: string | null;
  readonly targetType: CompatibilityTargetType;
  readonly targetId: string;
  readonly status: CompatibilityStatus;
  readonly justification: string | null;
  readonly restrictions: Record<string, unknown>;
  readonly evidence: Record<string, unknown>;
  readonly validatedBy: string | null;
  readonly validatedAt: Date | null;
  readonly createdAt: Date;
}
