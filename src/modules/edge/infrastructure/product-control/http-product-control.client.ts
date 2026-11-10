import { createHash, createHmac } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { CredentialProviderPort } from '../../domain/product-control/credential-provider.port.js';
import type {
  ProductControlClientPort,
  ProductControlClientRequest,
  ProductControlClientResponse,
} from '../../domain/product-control/product-control-client.port.js';
import { ProductControlErrorCode } from '../../domain/product-control/product-control.types.js';
import { parseDiscoveryDocument } from '../../domain/product-control/contract-validation.js';
import type { SignatureVerifierPort } from '../../domain/product-control/signature-verifier.port.js';

export type HttpProductControlClientOptions = {
  timeoutMs?: number;
  maxResponseBytes?: number;
  /** Test-only: allow http:// */
  allowInsecureHttp?: boolean;
  fetchImpl?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1_048_576;

/**
 * Typed outbound Product Control HTTP client.
 * Enforces TLS, host allowlist from endpoint base_url, no open redirects,
 * content-type + size limits, and credential resolution via opaque refs.
 */
export class HttpProductControlClient implements ProductControlClientPort {
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly allowInsecureHttp: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly credentials: CredentialProviderPort,
    private readonly signatures: SignatureVerifierPort,
    options: HttpProductControlClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_BYTES;
    this.allowInsecureHttp = options.allowInsecureHttp ?? false;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  handshake(req: ProductControlClientRequest) {
    return this.invoke(req, '/control/handshake');
  }

  discoverContract(req: ProductControlClientRequest) {
    return this.invoke(req, '/control/discover-contract');
  }

  discoverCapabilities(req: ProductControlClientRequest) {
    return this.invoke(req, '/control/discover-capabilities');
  }

  verifyConnectivity(req: ProductControlClientRequest) {
    return this.invoke(req, '/control/verify-connectivity');
  }

  verifyHealth(req: ProductControlClientRequest) {
    return this.invoke(req, '/control/verify-health');
  }

  verifyConformance(req: ProductControlClientRequest) {
    return this.invoke(req, '/control/verify-conformance');
  }

  private async invoke(
    req: ProductControlClientRequest,
    path: string,
  ): Promise<ProductControlClientResponse> {
    const base = this.parseAndValidateBaseUrl(req.baseUrl);
    const allowedHost = base.hostname.toLowerCase();
    const target = new URL(path.replace(/^\//, ''), ensureTrailingSlash(base.href));

    if (target.hostname.toLowerCase() !== allowedHost) {
      throw securityError(
        ProductControlErrorCode.AUTHORIZATION_FAILED,
        `Request host ${target.hostname} is outside endpoint allowlist (${allowedHost})`,
      );
    }

    const credential = await this.credentials.resolve(req.credentialRef, req.authProfile);
    if (credential.material.expiresAt && credential.material.expiresAt.getTime() <= Date.now()) {
      throw securityError(
        ProductControlErrorCode.REQUEST_EXPIRED,
        'Credential material expired',
      );
    }

    const issuedAt = new Date().toISOString();
    const payload = req.payload ?? {};
    const bodyText = JSON.stringify({
      ...payload,
      requestId: req.requestId,
      correlationId: req.correlationId,
      causationId: req.causationId ?? null,
      idempotencyKey: req.idempotencyKey,
      operationCode: req.operationCode,
      contractVersion: req.contractVersion,
      apiVersion: req.apiVersion,
      issuedAt,
    });
    const digest = this.signatures.digest(bodyText);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Request-Id': req.requestId,
      'X-Correlation-Id': req.correlationId,
      'Idempotency-Key': req.idempotencyKey,
      'X-Contract-Version': req.contractVersion,
      'X-Payload-Digest': digest,
      'X-Issued-At': issuedAt,
    };
    if (req.causationId) headers['X-Causation-Id'] = req.causationId;
    if (credential.material.accessToken) {
      headers.Authorization = `Bearer ${credential.material.accessToken}`;
    }
    if (credential.material.hmacSecret) {
      const signed = await this.signatures.verify({
        algorithm: 'HS256',
        payload: bodyText,
        signature: this.hmacHex(credential.material.hmacSecret, bodyText),
        keyMaterialRef: req.credentialRef,
        issuedAt,
      });
      // Sign outbound with HMAC — verify() used only to ensure secret usable;
      // attach computed signature header.
      void signed;
      headers['X-Signature'] = this.hmacHex(credential.material.hmacSecret, bodyText);
      headers['X-Signature-Alg'] = 'HS256';
    }

    const started = Date.now();
    const controller = new AbortController();
    const deadlineMs = req.deadlineAt
      ? Math.max(1, req.deadlineAt.getTime() - Date.now())
      : this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, deadlineMs));

    try {
      const response = await this.fetchWithRedirectGuard(
        target,
        {
          method: 'POST',
          headers,
          body: bodyText,
          signal: controller.signal,
          redirect: 'manual',
        },
        allowedHost,
      );

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        throw securityError(
          ProductControlErrorCode.INVALID_RESPONSE,
          `Unexpected content-type: ${contentType || 'missing'}`,
        );
      }

      const raw = await this.readLimitedBody(response);
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw securityError(
          ProductControlErrorCode.INVALID_RESPONSE,
          'Response body is not valid JSON',
        );
      }

      const responseDigest = createHash('sha256').update(raw).digest('hex');
      const durationMs = Date.now() - started;

      let discovery: ProductControlClientResponse['discovery'];
      const parsed = parseDiscoveryDocument(body.discovery ?? body);
      if (parsed.ok) {
        discovery = parsed.document;
      }

      return {
        httpStatus: response.status,
        body,
        responseDigest,
        durationMs,
        discovery,
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      if (isAbortError(err)) {
        throw new DomainError(
          ErrorCode.DEPENDENCY_UNAVAILABLE,
          'Product Control request timed out',
          [{ code: ProductControlErrorCode.TIMEOUT }],
          err instanceof Error ? err : undefined,
        );
      }
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        err instanceof Error ? err.message : 'Product Control network error',
        [{ code: ProductControlErrorCode.ENDPOINT_UNAVAILABLE }],
        err instanceof Error ? err : undefined,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private parseAndValidateBaseUrl(baseUrl: string): URL {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw securityError(ProductControlErrorCode.VALIDATION, 'Invalid endpoint base_url');
    }
    if (!this.allowInsecureHttp && url.protocol !== 'https:') {
      throw securityError(
        ProductControlErrorCode.TLS_VALIDATION_FAILED,
        'Product Control base_url must use HTTPS',
      );
    }
    if (this.allowInsecureHttp && url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw securityError(ProductControlErrorCode.VALIDATION, 'Unsupported URL protocol');
    }
    if (!url.hostname) {
      throw securityError(ProductControlErrorCode.VALIDATION, 'base_url missing hostname');
    }
    return url;
  }

  private async fetchWithRedirectGuard(
    url: URL,
    init: RequestInit,
    allowedHost: string,
    hop = 0,
  ): Promise<Response> {
    if (hop > 3) {
      throw securityError(
        ProductControlErrorCode.AUTHORIZATION_FAILED,
        'Too many redirects',
      );
    }
    const response = await this.fetchImpl(url, init);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw securityError(
          ProductControlErrorCode.AUTHORIZATION_FAILED,
          'Redirect without Location header',
        );
      }
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        throw securityError(
          ProductControlErrorCode.AUTHORIZATION_FAILED,
          'Invalid redirect Location',
        );
      }
      if (next.hostname.toLowerCase() !== allowedHost) {
        throw securityError(
          ProductControlErrorCode.AUTHORIZATION_FAILED,
          `Redirect to non-allowlisted host ${next.hostname} blocked (SSRF)`,
        );
      }
      if (!this.allowInsecureHttp && next.protocol !== 'https:') {
        throw securityError(
          ProductControlErrorCode.TLS_VALIDATION_FAILED,
          'Redirect to non-HTTPS blocked',
        );
      }
      return this.fetchWithRedirectGuard(next, { ...init, body: init.body }, allowedHost, hop + 1);
    }
    return response;
  }

  private async readLimitedBody(response: Response): Promise<string> {
    const lenHeader = response.headers.get('content-length');
    if (lenHeader && Number(lenHeader) > this.maxResponseBytes) {
      throw securityError(
        ProductControlErrorCode.INVALID_RESPONSE,
        `Response content-length ${lenHeader} exceeds limit ${this.maxResponseBytes}`,
      );
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > this.maxResponseBytes) {
      throw securityError(
        ProductControlErrorCode.INVALID_RESPONSE,
        `Response body exceeds limit ${this.maxResponseBytes}`,
      );
    }
    return buf.toString('utf8');
  }

  private hmacHex(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }
}

function ensureTrailingSlash(href: string): string {
  return href.endsWith('/') ? href : `${href}/`;
}

function securityError(code: ProductControlErrorCode, message: string): DomainError {
  return new DomainError(ErrorCode.FORBIDDEN, message, [{ code }]);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || /aborted|timeout/i.test(err.message));
}
