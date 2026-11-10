import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import type {
  P5AuthorizationStatusPort,
  P5AuthorizationStatusQuery,
  P5AuthorizationStatusResult,
} from '../../domain/provisioning/p5-authorization-status.port.js';
import { EdgeP5S2STokenClient } from './edge-p5-s2s-token.client.js';

/**
 * Synchronous P5 status check (OQ-04) with real S2S client_credentials auth.
 * Never calls P5 with only a correlation header.
 * Fail-closed on missing auth, TLS/host policy, timeout, transport, or unauthenticated responses.
 */
@Injectable()
export class FailClosedP5AuthorizationStatusAdapter implements P5AuthorizationStatusPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly s2s: EdgeP5S2STokenClient,
  ) {}

  async verifyCurrentStatus(
    query: P5AuthorizationStatusQuery,
  ): Promise<P5AuthorizationStatusResult> {
    const url = this.config.EDGE_P5_AUTHORIZATION_STATUS_URL;
    if (!url) {
      return unavailable(
        'P5_STATUS_ENDPOINT_NOT_CONFIGURED',
        'P5 authorization status endpoint is not configured; fail-closed (OQ-04)',
      );
    }

    if (!this.config.EDGE_P5_ALLOW_INSECURE_HTTP && !url.startsWith('https://')) {
      return unavailable(
        'P5_STATUS_URL_MUST_BE_HTTPS',
        'P5 status URL must use HTTPS unless EDGE_P5_ALLOW_INSECURE_HTTP=true',
      );
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return unavailable('P5_STATUS_URL_INVALID', 'P5 status URL is invalid');
    }

    const allowedHosts = (this.config.EDGE_P5_STATUS_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (allowedHosts.length > 0 && !allowedHosts.includes(target.hostname.toLowerCase())) {
      return unavailable(
        'P5_STATUS_HOST_NOT_ALLOWED',
        `P5 status host ${target.hostname} is not in EDGE_P5_STATUS_ALLOWED_HOSTS`,
      );
    }

    if (!this.s2s.isConfigured()) {
      return unavailable(
        'P5_S2S_NOT_CONFIGURED',
        'P5 S2S client_credentials (EDGE_P5_S2S_*) required; refuse unauthenticated call',
      );
    }

    const timeoutMs = this.config.EDGE_P5_AUTHORIZATION_STATUS_TIMEOUT_MS ?? 2000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let accessToken: string;
      try {
        accessToken = await this.s2s.getAccessToken();
      } catch (err) {
        this.s2s.clearCache();
        return unavailable(
          'P5_S2S_AUTH_FAILED',
          err instanceof Error ? err.message : 'S2S token acquisition failed',
        );
      }

      target.searchParams.set('authorizationId', query.authorizationId);
      target.searchParams.set('authorizationVersion', String(query.authorizationVersion));
      target.searchParams.set('correlationId', query.correlationId);

      const res = await fetch(target, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Correlation-Id': query.correlationId,
          'X-Edge-Service': 'okapi.edge.p7',
        },
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        this.s2s.clearCache();
        return unavailable(
          'P5_STATUS_UNAUTHORIZED',
          `P5 rejected S2S credentials (HTTP ${res.status})`,
        );
      }
      if (!res.ok) {
        return unavailable('P5_STATUS_HTTP_ERROR', `P5 status HTTP ${res.status}`);
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
      return unavailable(
        aborted ? 'P5_STATUS_TIMEOUT' : 'P5_STATUS_NETWORK_ERROR',
        aborted
          ? `P5 status timed out after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : 'network error',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function unavailable(reasonCode: string, failureMessage: string): P5AuthorizationStatusResult {
  return { outcome: 'UNAVAILABLE', reasonCode, failureMessage };
}
