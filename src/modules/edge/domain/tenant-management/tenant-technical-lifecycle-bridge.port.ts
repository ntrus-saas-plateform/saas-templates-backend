export const TENANT_TECHNICAL_LIFECYCLE_BRIDGE_PORT = Symbol(
  'TENANT_TECHNICAL_LIFECYCLE_BRIDGE_PORT',
);

export type TenantTechnicalLifecycleBridgeInput = {
  lifecycleRecordId: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  reason?: string | null;
};

export type TenantTechnicalLifecycleBridgeOutcome = {
  workflowId: string | null;
  outcome: 'STARTED' | 'SKIPPED_NO_RECORD' | 'FAILED';
  error?: string;
};

export interface TenantTechnicalLifecycleBridgePort {
  requestSuspend(
    input: TenantTechnicalLifecycleBridgeInput,
  ): Promise<TenantTechnicalLifecycleBridgeOutcome>;
  requestResume(
    input: TenantTechnicalLifecycleBridgeInput,
  ): Promise<TenantTechnicalLifecycleBridgeOutcome>;
  requestDeprovision(
    input: TenantTechnicalLifecycleBridgeInput & {
      authorized: boolean;
      confirmed: boolean;
    },
  ): Promise<TenantTechnicalLifecycleBridgeOutcome>;
}