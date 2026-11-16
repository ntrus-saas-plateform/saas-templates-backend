/**
 * Authoritative tenant runtime readiness for P10 portal provisioningComplete.
 * Never invent ready=true without an external signal.
 */

export const TENANT_RUNTIME_STATUS_PORT = Symbol('TENANT_RUNTIME_STATUS_PORT');

export type TenantRuntimeStatusResult = {
  ready: boolean;
  source: string;
  detail?: string;
};

export interface TenantRuntimeStatusPort {
  isTenantReady(tenantId: string): Promise<TenantRuntimeStatusResult>;
}
