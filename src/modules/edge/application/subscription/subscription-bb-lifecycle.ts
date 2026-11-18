import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import type { SubscriptionTenantAssociationPort } from '../../domain/ports/subscription-tenant-association.port.js';
import type { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';

export async function resolveSubscriptionTenantRef(input: {
  subscriptions: SubscriptionRepositoryPort;
  associations?: SubscriptionTenantAssociationPort;
  subscriptionId: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  if (input.associations) {
    const active = await input.associations.getActiveBySubscription(input.subscriptionId);
    if (active?.productTenantRef?.trim()) return active.productTenantRef.trim();
  }
  const reqs = await input.subscriptions.listProvisioningRequests(input.subscriptionId);
  const fromReq = reqs.map((r) => r.tenantRef).find((t): t is string => !!t?.trim());
  if (fromReq) return fromReq.trim();
  const meta = input.metadata ?? {};
  if (typeof meta.tenantRef === 'string' && meta.tenantRef.trim()) return meta.tenantRef.trim();
  if (typeof meta.tenantId === 'string' && meta.tenantId.trim()) return meta.tenantId.trim();
  return null;
}

export async function syncBbTenantLifecycle(input: {
  bbClient?: ControlV1BusinessBackendClient;
  action: 'suspend' | 'resume';
  tenantId: string;
  reason: string;
  correlationId: string;
}): Promise<{ synced: boolean; status?: number; skipped?: string }> {
  if (!input.bbClient?.isConfigured()) {
    return { synced: false, skipped: 'BB client not configured' };
  }
  const key = input.correlationId.slice(0, 128);
  const body = { tenant_id: input.tenantId, reason: input.reason };
  const res =
    input.action === 'suspend'
      ? await input.bbClient.suspendTenant(body, key)
      : await input.bbClient.resumeTenant(body, key);
  if (!res.ok) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      `BB tenant ${input.action} failed: HTTP ${res.status}`,
      [{ status: res.status, body: res.body }],
    );
  }
  return { synced: true, status: res.status };
}
