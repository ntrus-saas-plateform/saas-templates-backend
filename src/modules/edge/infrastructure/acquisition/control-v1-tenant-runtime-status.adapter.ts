import type {
  TenantRuntimeStatusPort,
  TenantRuntimeStatusResult,
} from '../../domain/acquisition/tenant-runtime-status.port.js';
import type { ControlV1BusinessBackendClient } from '../product-control/control-v1-business-backend.client.js';

/**
 * Queries BB GET /control/v1/tenants/:id/ready via the shared control-v1 client.
 * ready=true only on HTTP 200 with body indicating ready — never invent true on errors.
 */
export class ControlV1TenantRuntimeStatusAdapter implements TenantRuntimeStatusPort {
  constructor(private readonly client: ControlV1BusinessBackendClient) {}

  async isTenantReady(tenantId: string): Promise<TenantRuntimeStatusResult> {
    const id = tenantId?.trim();
    if (!id) {
      return { ready: false, source: 'CONTROL_V1', detail: 'tenantId required' };
    }

    if (!this.client.isConfigured()) {
      return {
        ready: false,
        source: 'CONTROL_V1',
        detail: 'EDGE_BB_CONTROL_BASE_URL not configured',
      };
    }

    try {
      const res = await this.client.getTenantReady(id);
      if (res.status !== 200) {
        return {
          ready: false,
          source: 'CONTROL_V1',
          detail: `HTTP ${res.status}`,
        };
      }
      const ready = bodyIndicatesReady(res.body);
      return {
        ready,
        source: 'CONTROL_V1',
        detail: ready ? undefined : 'body.ready not true',
      };
    } catch (err) {
      return {
        ready: false,
        source: 'CONTROL_V1',
        detail: err instanceof Error ? err.message : 'request failed',
      };
    }
  }
}

function bodyIndicatesReady(body: Record<string, unknown>): boolean {
  if (body.ready === true) return true;
  if (typeof body.status === 'string' && body.status.toLowerCase() === 'ready') {
    return true;
  }
  return false;
}
