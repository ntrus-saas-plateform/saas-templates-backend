import { createHash, randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type {
  InfrastructureProviderAdapter,
  ObserveResourceResult,
  ProvisionComputeInput,
  ProvisionComputeResult,
  ProvisionNetworkInput,
  ProvisionNetworkResult,
  ProvisionStorageInput,
  ProvisionStorageResult,
} from '../../domain/infrastructure-provisioning/database-provider.port.js';
import {
  DatabaseEngine,
  InfrastructureErrorCode,
  InfrastructureProviderKind,
  LOCAL_MANAGED_PROVIDER_CODE,
  ProviderOperationalStatus,
  ResourceType,
  type InfrastructureProviderRecord,
} from '../../domain/infrastructure-provisioning/infrastructure.types.js';

export type LocalManagedAdminConnections = {
  postgresql?: string;
  mongodb?: string;
  surrealdb?: string;
};

/**
 * Sole provider declared operational in P7.6.
 * Provisions private-by-default network/storage policies and delegates DB engines
 * to real adapters via admin connection refs (Testcontainers / lab hosts).
 */
export class LocalManagedInfrastructureProvider implements InfrastructureProviderAdapter {
  readonly providerCode = LOCAL_MANAGED_PROVIDER_CODE;
  private readonly resources = new Map<
    string,
    { type: ResourceType; configuration: Record<string, unknown>; status: string }
  >();

  constructor(
    private readonly adminConnections: LocalManagedAdminConnections = {},
    private readonly providerId: string = randomUUID(),
  ) {}

  async describe(): Promise<InfrastructureProviderRecord> {
    const now = new Date();
    return {
      id: this.providerId,
      code: this.providerCode,
      name: 'Local Managed Infrastructure Provider',
      providerVersion: '1.0.0',
      providerKind: InfrastructureProviderKind.LOCAL_MANAGED,
      operationalStatus: ProviderOperationalStatus.ACTIVE,
      capabilities: {
        encryption: true,
        backup: true,
        restore: true,
        highAvailability: false,
        privateNetworking: true,
        tlsRequired: true,
        operations: [
          'validate_plan',
          'provision_network',
          'provision_storage',
          'provision_database',
          'configure_security',
          'create_credentials',
          'verify_connectivity',
          'verify_isolation',
          'configure_backup',
          'verify_backup_policy',
          'reconcile',
          'deprovision',
        ],
      },
      supportedRegions: ['local', 'lab'],
      supportedResourceTypes: ['NETWORK', 'STORAGE', 'DATABASE', 'COMPUTE'],
      supportedDatabaseEngines: ['POSTGRESQL', 'MONGODB', 'SURREALDB'],
      metadata: {
        computeOptional: true,
        note: 'Compute workloads skipped when deployment profile does not require dedicated nodes',
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  adminConnectionRefFor(engine: DatabaseEngine): string {
    const map: Record<DatabaseEngine, string | undefined> = {
      [DatabaseEngine.POSTGRESQL]: this.adminConnections.postgresql,
      [DatabaseEngine.MONGODB]: this.adminConnections.mongodb,
      [DatabaseEngine.SURREALDB]: this.adminConnections.surrealdb,
    };
    const ref = map[engine];
    if (!ref) {
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        `No admin connection configured for ${engine}`,
        [{ code: InfrastructureErrorCode.DEPENDENCY_UNAVAILABLE, engine }],
      );
    }
    return ref;
  }

  async provisionNetwork(input: ProvisionNetworkInput): Promise<ProvisionNetworkResult> {
    if (input.publicEndpointAllowed) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Public endpoints are forbidden by local-managed baseline',
        [{ code: InfrastructureErrorCode.VALIDATION }],
      );
    }
    const providerResourceId = `net_${randomUUID()}`;
    const configuration = {
      mode: 'PRIVATE',
      denyByDefault: input.denyByDefault,
      cidrBlock: input.cidrBlock ?? '10.90.0.0/16',
      tenantId: input.tenantId,
      productId: input.productId,
      region: input.region,
      publicEndpointAllowed: false,
      ingress: [],
      egress: [{ action: 'ALLOW', dest: 'private-only' }],
    };
    const fingerprint = createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
    this.resources.set(providerResourceId, {
      type: ResourceType.NETWORK,
      configuration,
      status: 'READY',
    });
    return {
      providerResourceId,
      configuration,
      fingerprint,
      evidence: { provisionedAt: new Date().toISOString(), provider: this.providerCode },
    };
  }

  async provisionStorage(input: ProvisionStorageInput): Promise<ProvisionStorageResult> {
    if (!input.encrypted) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Storage encryption is mandatory', [
        { code: InfrastructureErrorCode.VALIDATION },
      ]);
    }
    const providerResourceId = `sto_${randomUUID()}`;
    const configuration = {
      sizeGb: input.sizeGb,
      encrypted: true,
      encryptionAlgorithm: 'AES-256',
      tenantId: input.tenantId,
      productId: input.productId,
      region: input.region,
    };
    const fingerprint = createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
    this.resources.set(providerResourceId, {
      type: ResourceType.STORAGE,
      configuration,
      status: 'READY',
    });
    return {
      providerResourceId,
      configuration,
      fingerprint,
      evidence: { provisionedAt: new Date().toISOString(), provider: this.providerCode },
    };
  }

  async provisionCompute(input: ProvisionComputeInput): Promise<ProvisionComputeResult> {
    const required = Boolean(input.requirements?.required);
    if (!required) {
      return {
        providerResourceId: `cmp_skipped_${input.tenantId}`,
        configuration: { skipped: true, reason: 'profile_does_not_require_compute' },
        fingerprint: createHash('sha256').update('skipped-compute').digest('hex'),
        evidence: { skipped: true },
        skipped: true,
      };
    }
    const providerResourceId = `cmp_${randomUUID()}`;
    const configuration = {
      tenantId: input.tenantId,
      productId: input.productId,
      region: input.region,
      requirements: input.requirements,
      runtime: 'local-managed-node',
    };
    const fingerprint = createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
    this.resources.set(providerResourceId, {
      type: ResourceType.COMPUTE,
      configuration,
      status: 'READY',
    });
    return {
      providerResourceId,
      configuration,
      fingerprint,
      evidence: { provisionedAt: new Date().toISOString() },
    };
  }

  async observeResource(
    providerResourceId: string,
    resourceType: ResourceType,
  ): Promise<ObserveResourceResult> {
    const found = this.resources.get(providerResourceId);
    if (!found) {
      return { exists: false, configuration: {}, status: 'MISSING', evidence: { resourceType } };
    }
    return {
      exists: true,
      configuration: found.configuration,
      status: found.status,
      evidence: { resourceType: found.type },
    };
  }

  async deprovisionResource(
    providerResourceId: string,
    _resourceType: ResourceType,
  ): Promise<{ evidence: Record<string, unknown> }> {
    const existed = this.resources.delete(providerResourceId);
    return { evidence: { deleted: existed, providerResourceId } };
  }
}
