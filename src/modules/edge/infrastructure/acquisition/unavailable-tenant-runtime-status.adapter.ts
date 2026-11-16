import type {
  TenantRuntimeStatusPort,
  TenantRuntimeStatusResult,
} from '../../domain/acquisition/tenant-runtime-status.port.js';

/**
 * Fail-closed default when EDGE_BB_CONTROL_BASE_URL is unset.
 */
export class UnavailableTenantRuntimeStatusAdapter implements TenantRuntimeStatusPort {
  async isTenantReady(_tenantId: string): Promise<TenantRuntimeStatusResult> {
    return { ready: false, source: 'UNAVAILABLE' };
  }
}
