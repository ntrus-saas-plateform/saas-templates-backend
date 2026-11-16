import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export const CONTROL_V1_BB_CLIENT_PORT = Symbol('CONTROL_V1_BB_CLIENT_PORT');

export type ControlV1BbClientOptions = {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  allowInsecureHttp?: boolean;
  fetchImpl?: typeof fetch;
};

export type ControlV1BbHttpResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
  text: string;
};

export type ControlV1BbProvisionBody = Record<string, unknown>;

/**
 * Outbound Edge → Business Backend `/control/v1` client (lab token or M2M).
 * Never fabricates success when baseUrl/token are missing — callers must fail closed.
 */
export class ControlV1BusinessBackendClient {
  private readonly baseUrl: string | undefined;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;
  private readonly allowInsecureHttp: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ControlV1BbClientOptions = {}) {
    this.baseUrl = options.baseUrl?.replace(/\/+$/, '') || undefined;
    this.token = options.token?.trim() || undefined;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.allowInsecureHttp = options.allowInsecureHttp ?? false;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  async provision(
    body: ControlV1BbProvisionBody,
    idempotencyKey: string,
  ): Promise<ControlV1BbHttpResult> {
    return this.request('POST', '/control/v1/provision', {
      body,
      idempotencyKey,
    });
  }

  async getTenantReady(tenantId: string): Promise<ControlV1BbHttpResult> {
    const id = encodeURIComponent(tenantId);
    return this.request('GET', `/control/v1/tenants/${id}/ready`);
  }

  async getTenantState(tenantId: string): Promise<ControlV1BbHttpResult> {
    const id = encodeURIComponent(tenantId);
    return this.request('GET', `/control/v1/tenants/${id}/state`);
  }

  private assertBaseUrl(): string {
    if (!this.baseUrl) {
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        'EDGE_BB_CONTROL_BASE_URL is not configured',
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(this.baseUrl);
    } catch {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'EDGE_BB_CONTROL_BASE_URL is not a valid URL',
      );
    }
    if (!this.allowInsecureHttp && parsed.protocol !== 'https:') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'EDGE_BB_CONTROL_BASE_URL must use https unless EDGE_BB_CONTROL_ALLOW_INSECURE_HTTP=true',
      );
    }
    if (
      this.allowInsecureHttp &&
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'EDGE_BB_CONTROL_BASE_URL must use http or https',
      );
    }
    return this.baseUrl;
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    opts?: { body?: Record<string, unknown>; idempotencyKey?: string },
  ): Promise<ControlV1BbHttpResult> {
    const base = this.assertBaseUrl();
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      headers['X-Edge-Control-Token'] = this.token;
    }
    if (opts?.idempotencyKey) {
      headers['Idempotency-Key'] = opts.idempotencyKey;
    }
    let bodyText: string | undefined;
    if (opts?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      bodyText = JSON.stringify(opts.body);
    }

    try {
      const res = await this.fetchImpl(url, {
        method,
        headers,
        body: bodyText,
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
      const text = await res.text().catch(() => '');
      let body: Record<string, unknown> = {};
      if (text) {
        try {
          const parsed = JSON.parse(text) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            body = parsed as Record<string, unknown>;
          } else {
            body = { value: parsed as unknown };
          }
        } catch {
          body = { raw: text.slice(0, 500) };
        }
      }
      return { ok: res.ok, status: res.status, body, text };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        `BB control transport error: ${message}`,
      );
    }
  }
}
