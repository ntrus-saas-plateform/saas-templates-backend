import {
  InfrastructureErrorCode,
  type InfrastructureProviderRecord,
  type ProviderCapabilities,
} from './infrastructure.types.js';

export type CapabilityMatchResult = {
  matched: boolean;
  missing: string[];
  code?: InfrastructureErrorCode;
  message?: string;
};

export function matchProviderCapabilities(args: {
  provider: Pick<
    InfrastructureProviderRecord,
    'operationalStatus' | 'capabilities' | 'supportedRegions' | 'supportedDatabaseEngines' | 'supportedResourceTypes'
  >;
  requiredOperations: string[];
  requiredRegion: string;
  requiredEngine: string;
  requiredResourceTypes?: string[];
  requirePrivateNetworking?: boolean;
  requireEncryption?: boolean;
  requireBackup?: boolean;
}): CapabilityMatchResult {
  const missing: string[] = [];
  if (args.provider.operationalStatus !== 'ACTIVE') {
    return {
      matched: false,
      missing: ['provider.active'],
      code: InfrastructureErrorCode.PROVIDER_UNAVAILABLE,
      message: `Provider status ${args.provider.operationalStatus}`,
    };
  }
  const caps: ProviderCapabilities = args.provider.capabilities;
  for (const op of args.requiredOperations) {
    if (!caps.operations?.includes(op)) missing.push(`operation:${op}`);
  }
  if (!args.provider.supportedRegions.includes(args.requiredRegion)) {
    missing.push(`region:${args.requiredRegion}`);
  }
  if (!args.provider.supportedDatabaseEngines.includes(args.requiredEngine)) {
    missing.push(`engine:${args.requiredEngine}`);
  }
  for (const rt of args.requiredResourceTypes ?? []) {
    if (!args.provider.supportedResourceTypes.includes(rt)) {
      missing.push(`resourceType:${rt}`);
    }
  }
  if (args.requirePrivateNetworking && !caps.privateNetworking) {
    missing.push('privateNetworking');
  }
  if (args.requireEncryption && !caps.encryption) {
    missing.push('encryption');
  }
  if (args.requireBackup && !caps.backup) {
    missing.push('backup');
  }
  if (missing.length > 0) {
    return {
      matched: false,
      missing,
      code: InfrastructureErrorCode.CAPABILITY_UNSUPPORTED,
      message: `Provider missing capabilities: ${missing.join(', ')}`,
    };
  }
  return { matched: true, missing: [] };
}

/** Unknown/undeclared capability must never be treated as available. */
export function isCapabilityDeclared(
  capabilities: ProviderCapabilities,
  key: keyof ProviderCapabilities,
): boolean {
  return Object.prototype.hasOwnProperty.call(capabilities, key);
}
