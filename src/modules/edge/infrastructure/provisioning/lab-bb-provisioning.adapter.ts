import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  ProvisioningCompleteInput,
  ProvisioningCompleteResult,
  ProvisioningRequestInput,
  ProvisioningRequestResult,
  SubscriptionProvisioningCoordinationPort,
} from '../../domain/subscription/provisioning-coordination.port.js';
import {
  CONTROL_V1_BB_CLIENT_PORT,
  type ControlV1BusinessBackendClient,
} from '../product-control/control-v1-business-backend.client.js';

/**
 * Lab-only P7 provisioning adapter: calls Business Backend `/control/v1/provision`
 * and polls `/tenants/:id/ready`. Never invents ACCEPTED/COMPLETE without BB HTTP proof.
 */
@Injectable()
export class LabBbProvisioningAdapter implements SubscriptionProvisioningCoordinationPort {
  constructor(
    @Inject(CONTROL_V1_BB_CLIENT_PORT)
    private readonly client: ControlV1BusinessBackendClient,
  ) {}

  async requestProvisioning(
    input: ProvisioningRequestInput,
  ): Promise<ProvisioningRequestResult> {
    if (!this.client.isConfigured()) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DEPENDENCY_UNAVAILABLE',
        failureMessage:
          'EDGE_BB_CONTROL_BASE_URL is not configured; lab_bb cannot call Business Backend',
      };
    }

    const payload = input.payload ?? {};
    const fromPayload =
      (typeof payload.tenantId === 'string' && payload.tenantId.trim()
        ? payload.tenantId.trim()
        : null) ??
      (typeof payload.tenant_id === 'string' && payload.tenant_id.trim()
        ? payload.tenant_id.trim()
        : null);
    const tenantId = fromPayload || randomUUID();

    // Minimal ControlProvisionBody fields required by BB validation.
    const body: Record<string, unknown> = {
      tenant_id: tenantId,
      account_id: input.accountId,
      subscription_id: input.subscriptionId,
      product_id: input.productId,
      plan_version: 'lab-1',
      region: 'lab',
      environment: 'staging',
      entitlement_version: 1,
      entitlements: {},
      initial_admin_contact: {
        name: 'Lab Admin',
        email: `lab-admin+${tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}@example.invalid`,
        locale: 'en',
      },
      note: 'lab_bb',
    };

    const idempotencyKey =
      input.correlationId?.trim().length >= 8
        ? input.correlationId.trim().slice(0, 128)
        : `lab-bb-${input.subscriptionId}-${tenantId}`.slice(0, 128);

    try {
      const res = await this.client.provision(body, idempotencyKey);
      if (res.ok && res.status >= 200 && res.status < 300) {
        return {
          outcome: 'ACCEPTED',
          externalRef: tenantId,
        };
      }
      return {
        outcome: 'UNAVAILABLE',
        failureCode: `HTTP_${res.status}`,
        failureMessage: `lab_bb BB provision failed: HTTP ${res.status}${
          res.text ? ` — ${res.text.slice(0, 200)}` : ''
        }`,
      };
    } catch (err) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DEPENDENCY_UNAVAILABLE',
        failureMessage:
          err instanceof Error ? err.message : `lab_bb provision failed: ${String(err)}`,
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
          'EDGE_BB_CONTROL_BASE_URL is not configured; lab_bb cannot poll tenant ready',
      };
    }

    const tenantId = (input.tenantRef ?? input.externalRef)?.trim() || null;
    if (!tenantId) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'TENANT_REF_REQUIRED',
        failureMessage: 'lab_bb completeProvisioning requires tenantRef or externalRef',
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
        return {
          outcome: 'COMPLETE',
          completedAt: new Date().toISOString(),
        };
      }

      if (res.ok && res.status === 200) {
        return {
          outcome: 'NOT_COMPLETE',
          failureCode: 'TENANT_NOT_READY',
          failureMessage: `lab_bb tenant ${tenantId} not ready yet`,
        };
      }

      return {
        outcome: 'UNAVAILABLE',
        failureCode: `HTTP_${res.status}`,
        failureMessage: `lab_bb getTenantReady failed: HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        outcome: 'UNAVAILABLE',
        failureCode: 'DEPENDENCY_UNAVAILABLE',
        failureMessage:
          err instanceof Error ? err.message : `lab_bb ready poll failed: ${String(err)}`,
      };
    }
  }
}
