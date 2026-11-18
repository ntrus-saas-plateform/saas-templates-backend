import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import type {
  ProvisioningCompleteInput,
  ProvisioningCompleteResult,
  ProvisioningRequestInput,
  ProvisioningRequestResult,
  SubscriptionProvisioningCoordinationPort,
} from '../../domain/subscription/provisioning-coordination.port.js';
import { assessEntitlementPayload } from '../../domain/provisioning/entitlement-payload.guard.js';
import {
  CONTROL_V1_BB_CLIENT_PORT,
  type ControlV1BusinessBackendClient,
} from '../product-control/control-v1-business-backend.client.js';

/**
 * Production P7 adapter — calls Business Backend `/control/v1/provision` with
 * **non-empty** entitlements and polls `/tenants/:id/ready`.
 *
 * Distinct from `lab_bb` (forbidden in production). Fail-closed on empty grants.
 */
@Injectable()
export class BbControlProvisioningAdapter implements SubscriptionProvisioningCoordinationPort {
  constructor(
    @Inject(CONTROL_V1_BB_CLIENT_PORT)
    private readonly client: ControlV1BusinessBackendClient,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  async requestProvisioning(
    input: ProvisioningRequestInput,
  ): Promise<ProvisioningRequestResult> {
    if (!this.client.isConfigured()) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DEPENDENCY_UNAVAILABLE',
        failureMessage:
          'EDGE_BB_CONTROL_BASE_URL is not configured; bb_control cannot call Business Backend',
      };
    }

    const payload = input.payload ?? {};
    const entitlementsRaw =
      payload.entitlements && typeof payload.entitlements === 'object'
        ? (payload.entitlements as Record<string, unknown>)
        : null;
    const grants = Array.isArray(payload.grants) ? payload.grants : [];
    const emptiness = assessEntitlementPayload(entitlementsRaw ?? {}, grants);
    if (emptiness.empty) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'EMPTY_ENTITLEMENTS_FORBIDDEN',
        failureMessage: `bb_control refuses empty entitlements (${emptiness.reason}). Attach plan/add-on projection first (RGOM-E7).`,
      };
    }

    const fromPayload =
      (typeof payload.tenantId === 'string' && payload.tenantId.trim()
        ? payload.tenantId.trim()
        : null) ??
      (typeof payload.tenant_id === 'string' && payload.tenant_id.trim()
        ? payload.tenant_id.trim()
        : null);
    const tenantId = fromPayload || randomUUID();

    const entitlementVersion =
      typeof payload.entitlement_version === 'number'
        ? payload.entitlement_version
        : typeof payload.entitlementVersion === 'number'
          ? payload.entitlementVersion
          : 1;

    const productCode =
      (typeof payload.product_code === 'string' && payload.product_code.trim()) ||
      (typeof payload.productCode === 'string' && payload.productCode.trim()) ||
      null;
    const profileCode =
      (typeof payload.profile_code === 'string' && payload.profile_code.trim()) ||
      (typeof payload.profileCode === 'string' && payload.profileCode.trim()) ||
      beachheadProfileForProduct(productCode ?? input.productId);

    const admin = resolveAdminContact(payload, tenantId);
    const contentHash = hashEntitlements(entitlementsRaw!, grants);

    const nestedEntitlements: Record<string, unknown> = {
      ...entitlementsRaw!,
      grants,
      contentHash,
    };

    const body: Record<string, unknown> = {
      tenant_id: tenantId,
      account_id: input.accountId,
      subscription_id: input.subscriptionId,
      product_id: productCode ?? input.productId,
      profile_code: profileCode ?? undefined,
      plan_version:
        typeof payload.plan_version === 'string'
          ? payload.plan_version
          : typeof payload.planVersion === 'string'
            ? payload.planVersion
            : 'edge-1',
      region:
        typeof payload.region === 'string' && payload.region.trim()
          ? payload.region.trim()
          : 'default',
      environment:
        typeof payload.environment === 'string' && payload.environment.trim()
          ? payload.environment.trim()
          : this.config.NODE_ENV === 'production'
            ? 'production'
            : 'staging',
      entitlement_version: entitlementVersion,
      entitlements: nestedEntitlements,
      grants,
      initial_admin_contact: admin,
      note: 'bb_control',
    };

    const idempotencyKey =
      input.correlationId?.trim().length >= 8
        ? input.correlationId.trim().slice(0, 128)
        : `bb-control-${input.subscriptionId}-${tenantId}`.slice(0, 128);

    try {
      const res = await this.client.provision(body, idempotencyKey);
      if (res.ok && res.status >= 200 && res.status < 300) {
        return { outcome: 'ACCEPTED', externalRef: tenantId };
      }
      return {
        outcome: 'UNAVAILABLE',
        failureCode: `HTTP_${res.status}`,
        failureMessage: `bb_control BB provision failed: HTTP ${res.status}${
          res.text ? ` — ${res.text.slice(0, 200)}` : ''
        }`,
      };
    } catch (err) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DEPENDENCY_UNAVAILABLE',
        failureMessage:
          err instanceof Error ? err.message : `bb_control provision failed: ${String(err)}`,
      };
    }
  }

  async completeProvisioning(
    input: ProvisioningCompleteInput,
  ): Promise<ProvisioningCompleteResult> {
    if (!this.client.isConfigured()) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DEPENDENCY_UNAVAILABLE',
        failureMessage:
          'EDGE_BB_CONTROL_BASE_URL is not configured; bb_control cannot poll tenant ready',
      };
    }

    const tenantId = (input.tenantRef ?? input.externalRef)?.trim() || null;
    if (!tenantId) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'TENANT_REF_REQUIRED',
        failureMessage: 'bb_control completeProvisioning requires tenantRef or externalRef',
      };
    }

    try {
      const res = await this.client.getTenantReady(tenantId);
      const ready =
        res.ok &&
        res.status === 200 &&
        (res.body.ready === true ||
          (typeof res.body.status === 'string' &&
            res.body.status.toLowerCase() === 'ready'));

      if (ready) {
        return { outcome: 'COMPLETE', completedAt: new Date().toISOString() };
      }

      if (res.ok && (res.status === 200 || res.status === 503)) {
        return {
          outcome: 'NOT_COMPLETE',
          failureCode: 'TENANT_NOT_READY',
          failureMessage: `bb_control tenant ${tenantId} not ready yet`,
        };
      }

      return {
        outcome: 'UNAVAILABLE',
        failureCode: `HTTP_${res.status}`,
        failureMessage: `bb_control getTenantReady failed: HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DEPENDENCY_UNAVAILABLE',
        failureMessage:
          err instanceof Error ? err.message : `bb_control ready poll failed: ${String(err)}`,
      };
    }
  }
}

function hashEntitlements(
  entitlements: Record<string, unknown>,
  grants: unknown[],
): string {
  return createHash('sha256')
    .update(JSON.stringify({ entitlements, grants }))
    .digest('hex');
}

/** ADR-021 — product code → BB business profile (bindings registry). */
function beachheadProfileForProduct(productRef: string | null | undefined): string | null {
  if (!productRef?.trim()) return null;
  // Lazy import avoided for adapter purity — mirror product-family-bindings defaults.
  const key = productRef.trim().toUpperCase().replace(/-/g, '_');
  const table: Record<string, string> = {
    SYNTIX_PHARMA: 'PHARMACY',
    OKAPI_RESTAURANT: 'RESTAURANT',
    OKAPI_RETAIL: 'SUPERMARKET',
    OKAPI_HOSPITALITY: 'HOTEL_HOSPITALITY',
    OKAPI_MANUFACTURING: 'MANUFACTURING',
    OKAPI_EQUIPMENT_RENTAL: 'EQUIPMENT_RENTAL',
  };
  if (table[key]) return table[key];
  if (key.includes('SYNTIX') || key.includes('PHARMA') || key.includes('PHARMACY')) {
    return 'PHARMACY';
  }
  if (key.includes('CAFE')) return 'CAFE';
  if (key.includes('RESTAURANT') || key.includes('OKAPI_REST')) return 'RESTAURANT';
  if (key.includes('HOTEL') || key.includes('HOSPITALITY')) return 'HOTEL_HOSPITALITY';
  if (key.includes('RETAIL') || key.includes('SUPERMARKET')) return 'SUPERMARKET';
  if (key.includes('MANUFACTUR')) return 'MANUFACTURING';
  if (key.includes('RENTAL')) return 'EQUIPMENT_RENTAL';
  return null;
}

function resolveAdminContact(
  payload: Record<string, unknown>,
  tenantId: string,
): { name: string; email: string; locale: string } {
  const raw = payload.initial_admin_contact ?? payload.initialAdminContact;
  if (raw && typeof raw === 'object') {
    const c = raw as Record<string, unknown>;
    const email = typeof c.email === 'string' ? c.email.trim() : '';
    const name = typeof c.name === 'string' ? c.name.trim() : 'Tenant Admin';
    if (email.includes('@')) {
      return {
        name: name || 'Tenant Admin',
        email,
        locale: typeof c.locale === 'string' ? c.locale : 'fr',
      };
    }
  }
  const emailFallback =
    (typeof payload.adminEmail === 'string' && payload.adminEmail.trim()) ||
    (typeof payload.admin_email === 'string' && payload.admin_email.trim()) ||
    null;
  if (emailFallback?.includes('@')) {
    return {
      name:
        (typeof payload.adminName === 'string' && payload.adminName.trim()) ||
        'Tenant Admin',
      email: emailFallback,
      locale: 'fr',
    };
  }
  // Fail-closed shape still required by BB schema — ops must override via payload.
  return {
    name: 'Tenant Admin',
    email: `admin+${tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@tenant.local`,
    locale: 'fr',
  };
}
