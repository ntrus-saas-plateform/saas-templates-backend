import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import type {
  P5AuthorizationStatusPort,
  P5AuthorizationStatusQuery,
  P5AuthorizationStatusResult,
} from '../../domain/provisioning/p5-authorization-status.port.js';

/**
 * Synchronous P5 status check (OQ-04).
 * Default: UNAVAILABLE → callers must fail-closed.
 * When EDGE_P5_AUTHORIZATION_STATUS_URL is set, HTTP GET with 2s timeout.
 */
@Injectable()
export class FailClosedP5AuthorizationStatusAdapter implements P5AuthorizationStatusPort {
  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {}

  async verifyCurrentStatus(
    query: P5AuthorizationStatusQuery,
  ): Promise<P5AuthorizationStatusResult> {
    const url = this.config.EDGE_P5_AUTHORIZATION_STATUS_URL;
    if (!url) {
      return {
        outcome: 'UNAVAILABLE',
        reasonCode: 'P5_STATUS_ENDPOINT_NOT_CONFIGURED',
        failureMessage:
          'P5 authorization status endpoint is not configured; fail-closed (OQ-04)',
      };
    }

    const timeoutMs = this.config.EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS ?? 2000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const target = new URL(url);
      target.searchParams.set('authorizationId', query.authorizationId);
      target.searchParams.set('authorizationVersion', String(query.authorizationVersion));
      target.searchParams.set('correlationId', query.correlationId);

      const res = await fetch(target, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Correlation-Id': query.correlationId,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        return {
          outcome: 'UNAVAILABLE',
          reasonCode: 'P5_STATUS_HTTP_ERROR',
          failureMessage: `P5 status HTTP ${res.status}`,
        };
      }
      const body = (await res.json()) as {
        outcome?: string;
        revocationVersion?: number | null;
        reasonCode?: string | null;
      };
      const outcome = body.outcome;
      if (
        outcome === 'ACTIVE' ||
        outcome === 'REVOKED' ||
        outcome === 'EXPIRED' ||
        outcome === 'DENY' ||
        outcome === 'UNKNOWN'
      ) {
        return {
          outcome,
          revocationVersion: body.revocationVersion ?? null,
          reasonCode: body.reasonCode ?? null,
        };
      }
      return {
        outcome: 'UNKNOWN',
        reasonCode: 'P5_STATUS_UNPARSEABLE',
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        outcome: 'UNAVAILABLE',
        reasonCode: aborted ? 'P5_STATUS_TIMEOUT' : 'P5_STATUS_NETWORK_ERROR',
        failureMessage: aborted
          ? `P5 status timed out after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : 'network error',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
