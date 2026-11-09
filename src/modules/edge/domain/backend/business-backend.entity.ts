export enum BackendBindingType {
  PRIMARY = 'PRIMARY',
  SUPPORTING = 'SUPPORTING',
  INTEGRATION = 'INTEGRATION',
  EXTERNAL = 'EXTERNAL',
}

export interface BusinessBackend {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly backendType: string | null;
  readonly lifecycleStatus: string;
  readonly deploymentModes: readonly unknown[];
  readonly supportedProtocols: readonly unknown[];
  readonly supportedApiVersions: readonly unknown[];
  readonly supportedEventVersions: readonly unknown[];
  readonly securityProfile: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductBackendBinding {
  readonly id: string;
  readonly productId: string;
  readonly productVersionId: string | null;
  readonly backendId: string;
  readonly bindingType: BackendBindingType;
  readonly deploymentMode: string | null;
  readonly compatibilityStatus: string | null;
  readonly effectiveFrom: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}
