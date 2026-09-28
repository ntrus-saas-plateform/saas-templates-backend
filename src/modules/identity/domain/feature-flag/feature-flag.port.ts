export interface FeatureContext {
  readonly tenantId: string;
  readonly organizationId?: string | null;
  readonly userId?: string | null;
}

export interface FeatureFlagEntry {
  readonly key: string;
  readonly enabled: boolean;
  readonly namespace: string;
  readonly defaultValue: unknown;
  readonly overrideable: boolean;
}

export interface FeatureFlagServicePort {
  isEnabled(flag: string, context?: FeatureContext): Promise<boolean>;
  listFlags(context?: FeatureContext): Promise<Readonly<Record<string, boolean>>>;
  listFlagsPage(
    context: FeatureContext | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: readonly FeatureFlagEntry[]; total: number }>;
}

export const FEATURE_FLAG_SERVICE_PORT = Symbol('FEATURE_FLAG_SERVICE_PORT');
