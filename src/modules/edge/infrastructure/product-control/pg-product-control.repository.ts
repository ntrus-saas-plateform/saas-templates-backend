import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  ControlExchangeAttemptInsert,
  ProductControlHistoryInsert,
  ProductControlRepositoryPort,
} from '../../domain/product-control/product-control-repository.port.js';
import {
  ControlCallbackStatus,
  ControlExchangeStatus,
  CredentialBindingStatus,
  ExchangeReconciliationStatus,
  NegotiatedContractStatus,
  ProductControlEndpointStatus,
  type ControlCallbackRecord,
  type ControlExchangeRecord,
  type CredentialBindingRecord,
  type NegotiatedContractRecord,
  type ProductControlCapabilityRecord,
  type ProductControlEndpointRecord,
  type ProductControlHealthCheckRecord,
  type ProductControlReconciliationRecord,
} from '../../domain/product-control/product-control.types.js';

type Row = Record<string, unknown>;

function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

function asDate(v: unknown): Date {
  if (v instanceof Date) return v;
  return new Date(String(v));
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class PgProductControlRepository implements ProductControlRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    const res = await executor.query(sql, params);
    return res.rows as T[];
  }

  private mapEndpoint(r: Row): ProductControlEndpointRecord {
    return {
      id: String(r.id),
      productRegistryId: String(r.product_registry_id),
      productId: String(r.product_id),
      platformId: String(r.platform_id),
      environmentId: r.environment_id == null ? null : String(r.environment_id),
      deploymentProfileId:
        r.deployment_profile_id == null ? null : String(r.deployment_profile_id),
      registryContractId: r.registry_contract_id == null ? null : String(r.registry_contract_id),
      code: String(r.code),
      baseUrl: String(r.base_url),
      apiVersion: String(r.api_version),
      contractVersion: String(r.contract_version),
      authProfile: String(r.auth_profile),
      credentialRef: String(r.credential_ref),
      allowedScopes: asJson(r.allowed_scopes, []),
      status: String(r.status) as ProductControlEndpointStatus,
      contractFingerprint: r.contract_fingerprint == null ? null : String(r.contract_fingerprint),
      identityFingerprint: r.identity_fingerprint == null ? null : String(r.identity_fingerprint),
      registrationSource: String(r.registration_source),
      lastHandshakeAt: r.last_handshake_at == null ? null : asDate(r.last_handshake_at),
      lastHandshakeStatus:
        r.last_handshake_status == null ? null : String(r.last_handshake_status),
      lastHandshakeError: r.last_handshake_error == null ? null : String(r.last_handshake_error),
      lastHealthCheckAt: r.last_health_check_at == null ? null : asDate(r.last_health_check_at),
      lastHealthStatus: r.last_health_status == null ? null : String(r.last_health_status),
      metadata: asJson(r.metadata, {}),
      version: num(r.version),
      createdBy: r.created_by == null ? null : String(r.created_by),
      updatedBy: r.updated_by == null ? null : String(r.updated_by),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapContract(r: Row): NegotiatedContractRecord {
    return {
      id: String(r.id),
      endpointId: String(r.endpoint_id),
      contractVersion: String(r.contract_version),
      fingerprint: String(r.fingerprint),
      schemaSnapshot: asJson(r.schema_snapshot, {}),
      supportedVersions: asJson(r.supported_versions, []),
      status: String(r.status) as NegotiatedContractStatus,
      discoveredAt: asDate(r.discovered_at),
      validatedAt: r.validated_at == null ? null : asDate(r.validated_at),
      metadata: asJson(r.metadata, {}),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapCapability(r: Row): ProductControlCapabilityRecord {
    return {
      id: String(r.id),
      endpointId: String(r.endpoint_id),
      capabilityCode: String(r.capability_code),
      declaredAt: asDate(r.declared_at),
      metadata: asJson(r.metadata, {}),
      createdAt: asDate(r.created_at),
    };
  }

  private mapExchange(r: Row): ControlExchangeRecord {
    return {
      id: String(r.id),
      productId: String(r.product_id),
      endpointId: String(r.endpoint_id),
      workflowId: r.workflow_id == null ? null : String(r.workflow_id),
      stepId: r.step_id == null ? null : String(r.step_id),
      operationCode: String(r.operation_code),
      contractVersion: String(r.contract_version),
      requestId: String(r.request_id),
      correlationId: String(r.correlation_id),
      causationId: r.causation_id == null ? null : String(r.causation_id),
      idempotencyKey: String(r.idempotency_key),
      requestDigest: r.request_digest == null ? null : String(r.request_digest),
      responseDigest: r.response_digest == null ? null : String(r.response_digest),
      requestTimestamp: asDate(r.request_timestamp),
      responseTimestamp: r.response_timestamp == null ? null : asDate(r.response_timestamp),
      status: String(r.status) as ControlExchangeStatus,
      attemptCount: num(r.attempt_count),
      httpStatus: r.http_status == null ? null : num(r.http_status),
      errorClassification:
        r.error_classification == null ? null : String(r.error_classification),
      durationMs: r.duration_ms == null ? null : num(r.duration_ms),
      retryEligible: Boolean(r.retry_eligible),
      reconciliationStatus: String(r.reconciliation_status) as ExchangeReconciliationStatus,
      requestPayload: asJson(r.request_payload, {}),
      responsePayload: asJson(r.response_payload, {}),
      diagnostics: asJson(r.diagnostics, {}),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapCallback(r: Row): ControlCallbackRecord {
    return {
      id: String(r.id),
      endpointId: String(r.endpoint_id),
      exchangeId: r.exchange_id == null ? null : String(r.exchange_id),
      callbackId: String(r.callback_id),
      correlationId: r.correlation_id == null ? null : String(r.correlation_id),
      requestId: r.request_id == null ? null : String(r.request_id),
      receivedAt: asDate(r.received_at),
      signatureValid: r.signature_valid == null ? null : Boolean(r.signature_valid),
      payload: asJson(r.payload, {}),
      status: String(r.status) as ControlCallbackStatus,
      rejectionReason: r.rejection_reason == null ? null : String(r.rejection_reason),
      idempotencyKey: String(r.idempotency_key),
      createdAt: asDate(r.created_at),
    };
  }

  private mapHealth(r: Row): ProductControlHealthCheckRecord {
    return {
      id: String(r.id),
      endpointId: String(r.endpoint_id),
      checkedAt: asDate(r.checked_at),
      result: String(r.result),
      latencyMs: r.latency_ms == null ? null : num(r.latency_ms),
      httpStatus: r.http_status == null ? null : num(r.http_status),
      errorClassification:
        r.error_classification == null ? null : String(r.error_classification),
      details: asJson(r.details, {}),
      createdAt: asDate(r.created_at),
    };
  }

  private mapReconciliation(r: Row): ProductControlReconciliationRecord {
    return {
      id: String(r.id),
      exchangeId: String(r.exchange_id),
      endpointId: String(r.endpoint_id),
      reason: String(r.reason),
      status: String(r.status),
      openedAt: asDate(r.opened_at),
      resolvedAt: r.resolved_at == null ? null : asDate(r.resolved_at),
      resolvedBy: r.resolved_by == null ? null : String(r.resolved_by),
      resolutionNotes: r.resolution_notes == null ? null : String(r.resolution_notes),
      details: asJson(r.details, {}),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapCredential(r: Row): CredentialBindingRecord {
    return {
      id: String(r.id),
      endpointId: String(r.endpoint_id),
      credentialRef: String(r.credential_ref),
      authProfile: String(r.auth_profile),
      status: String(r.status) as CredentialBindingStatus,
      boundAt: asDate(r.bound_at),
      expiresAt: r.expires_at == null ? null : asDate(r.expires_at),
      revokedAt: r.revoked_at == null ? null : asDate(r.revoked_at),
      revokedBy: r.revoked_by == null ? null : String(r.revoked_by),
      metadata: asJson(r.metadata, {}),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  async findEndpointById(id: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_endpoints WHERE id = $1`,
      [id],
      client,
    );
    return rows[0] ? this.mapEndpoint(rows[0]) : null;
  }

  async findEndpointByIdForUpdate(id: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_endpoints WHERE id = $1 FOR UPDATE`,
      [id],
      client,
    );
    return rows[0] ? this.mapEndpoint(rows[0]) : null;
  }

  async findEndpointByCode(code: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_endpoints WHERE code = $1`,
      [code],
      client,
    );
    return rows[0] ? this.mapEndpoint(rows[0]) : null;
  }

  async listEndpoints(
    filter: {
      productId?: string;
      platformId?: string;
      status?: ProductControlEndpointStatus;
      limit?: number;
      offset?: number;
    },
    client?: unknown,
  ) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter.platformId) {
      params.push(filter.platformId);
      where.push(`platform_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_endpoints ${wh}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
      client,
    );
    return rows.map((r) => this.mapEndpoint(r));
  }

  async insertEndpoint(
    row: Omit<ProductControlEndpointRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_endpoints (
         id, product_registry_id, product_id, platform_id, environment_id,
         deployment_profile_id, registry_contract_id, code, base_url, api_version,
         contract_version, auth_profile, credential_ref, allowed_scopes, status,
         contract_fingerprint, identity_fingerprint, registration_source,
         last_handshake_at, last_handshake_status, last_handshake_error,
         last_health_check_at, last_health_status, metadata, created_by, updated_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26
       ) RETURNING *`,
      [
        row.id ?? null,
        row.productRegistryId,
        row.productId,
        row.platformId,
        row.environmentId,
        row.deploymentProfileId,
        row.registryContractId,
        row.code,
        row.baseUrl,
        row.apiVersion,
        row.contractVersion,
        row.authProfile,
        row.credentialRef,
        JSON.stringify(row.allowedScopes ?? []),
        row.status,
        row.contractFingerprint,
        row.identityFingerprint,
        row.registrationSource,
        row.lastHandshakeAt,
        row.lastHandshakeStatus,
        row.lastHandshakeError,
        row.lastHealthCheckAt,
        row.lastHealthStatus,
        JSON.stringify(row.metadata ?? {}),
        row.createdBy,
        row.updatedBy,
      ],
      client,
    );
    return this.mapEndpoint(rows[0]!);
  }

  async updateEndpointStatus(
    id: string,
    fromStatus: ProductControlEndpointStatus,
    toStatus: ProductControlEndpointStatus,
    expectedVersion: number,
    patch: Partial<
      Pick<
        ProductControlEndpointRecord,
        | 'contractFingerprint'
        | 'identityFingerprint'
        | 'lastHandshakeAt'
        | 'lastHandshakeStatus'
        | 'lastHandshakeError'
        | 'lastHealthCheckAt'
        | 'lastHealthStatus'
        | 'updatedBy'
        | 'metadata'
      >
    >,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_product_control_endpoints SET
         status = $3,
         contract_fingerprint = COALESCE($4, contract_fingerprint),
         identity_fingerprint = COALESCE($5, identity_fingerprint),
         last_handshake_at = COALESCE($6, last_handshake_at),
         last_handshake_status = COALESCE($7, last_handshake_status),
         last_handshake_error = COALESCE($8, last_handshake_error),
         last_health_check_at = COALESCE($9, last_health_check_at),
         last_health_status = COALESCE($10, last_health_status),
         metadata = COALESCE($11::jsonb, metadata),
         updated_by = COALESCE($12, updated_by),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND status = $2 AND version = $13
       RETURNING *`,
      [
        id,
        fromStatus,
        toStatus,
        patch.contractFingerprint ?? null,
        patch.identityFingerprint ?? null,
        patch.lastHandshakeAt ?? null,
        patch.lastHandshakeStatus ?? null,
        patch.lastHandshakeError ?? null,
        patch.lastHealthCheckAt ?? null,
        patch.lastHealthStatus ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
        expectedVersion,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Product Control endpoint version/status conflict',
        [{ id, fromStatus, toStatus, expectedVersion }],
      );
    }
    return this.mapEndpoint(rows[0]);
  }

  async insertNegotiatedContract(
    row: Omit<NegotiatedContractRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_negotiated_contracts (
         id, endpoint_id, contract_version, fingerprint, schema_snapshot,
         supported_versions, status, discovered_at, validated_at, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb
       ) RETURNING *`,
      [
        row.id ?? null,
        row.endpointId,
        row.contractVersion,
        row.fingerprint,
        JSON.stringify(row.schemaSnapshot ?? {}),
        JSON.stringify(row.supportedVersions ?? []),
        row.status,
        row.discoveredAt,
        row.validatedAt,
        JSON.stringify(row.metadata ?? {}),
      ],
      client,
    );
    return this.mapContract(rows[0]!);
  }

  async replaceCapabilities(
    endpointId: string,
    capabilities: Array<{ capabilityCode: string; metadata?: Record<string, unknown> }>,
    client?: unknown,
  ) {
    await this.q(
      `DELETE FROM edge_p7_product_control_capabilities WHERE endpoint_id = $1`,
      [endpointId],
      client,
    );
    const out: ProductControlCapabilityRecord[] = [];
    for (const cap of capabilities) {
      const rows = await this.q(
        `INSERT INTO edge_p7_product_control_capabilities (
           endpoint_id, capability_code, metadata
         ) VALUES ($1,$2,$3::jsonb) RETURNING *`,
        [endpointId, cap.capabilityCode, JSON.stringify(cap.metadata ?? {})],
        client,
      );
      out.push(this.mapCapability(rows[0]!));
    }
    return out;
  }

  async listCapabilities(endpointId: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_capabilities
       WHERE endpoint_id = $1 ORDER BY capability_code`,
      [endpointId],
      client,
    );
    return rows.map((r) => this.mapCapability(r));
  }

  async insertExchange(
    row: Omit<ControlExchangeRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_exchanges (
         id, product_id, endpoint_id, workflow_id, step_id, operation_code, contract_version,
         request_id, correlation_id, causation_id, idempotency_key, request_digest,
         response_digest, request_timestamp, response_timestamp, status, attempt_count,
         http_status, error_classification, duration_ms, retry_eligible, reconciliation_status,
         request_payload, response_payload, diagnostics
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24::jsonb,$25::jsonb
       ) RETURNING *`,
      [
        row.id ?? null,
        row.productId,
        row.endpointId,
        row.workflowId,
        row.stepId,
        row.operationCode,
        row.contractVersion,
        row.requestId,
        row.correlationId,
        row.causationId,
        row.idempotencyKey,
        row.requestDigest,
        row.responseDigest,
        row.requestTimestamp,
        row.responseTimestamp,
        row.status,
        row.attemptCount,
        row.httpStatus,
        row.errorClassification,
        row.durationMs,
        row.retryEligible,
        row.reconciliationStatus,
        JSON.stringify(row.requestPayload ?? {}),
        JSON.stringify(row.responsePayload ?? {}),
        JSON.stringify(row.diagnostics ?? {}),
      ],
      client,
    );
    return this.mapExchange(rows[0]!);
  }

  async updateExchangeStatus(
    id: string,
    fromStatus: ControlExchangeStatus,
    toStatus: ControlExchangeStatus,
    expectedVersion: number,
    patch: Partial<
      Pick<
        ControlExchangeRecord,
        | 'attemptCount'
        | 'httpStatus'
        | 'errorClassification'
        | 'durationMs'
        | 'retryEligible'
        | 'reconciliationStatus'
        | 'responseDigest'
        | 'responseTimestamp'
        | 'responsePayload'
        | 'diagnostics'
      >
    >,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_product_control_exchanges SET
         status = $3,
         attempt_count = COALESCE($4, attempt_count),
         http_status = COALESCE($5, http_status),
         error_classification = COALESCE($6, error_classification),
         duration_ms = COALESCE($7, duration_ms),
         retry_eligible = COALESCE($8, retry_eligible),
         reconciliation_status = COALESCE($9, reconciliation_status),
         response_digest = COALESCE($10, response_digest),
         response_timestamp = COALESCE($11, response_timestamp),
         response_payload = COALESCE($12::jsonb, response_payload),
         diagnostics = COALESCE($13::jsonb, diagnostics),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND status = $2 AND version = $14
       RETURNING *`,
      [
        id,
        fromStatus,
        toStatus,
        patch.attemptCount ?? null,
        patch.httpStatus ?? null,
        patch.errorClassification ?? null,
        patch.durationMs ?? null,
        patch.retryEligible ?? null,
        patch.reconciliationStatus ?? null,
        patch.responseDigest ?? null,
        patch.responseTimestamp ?? null,
        patch.responsePayload ? JSON.stringify(patch.responsePayload) : null,
        patch.diagnostics ? JSON.stringify(patch.diagnostics) : null,
        expectedVersion,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Control exchange version/status conflict', [
        { id, fromStatus, toStatus, expectedVersion },
      ]);
    }
    return this.mapExchange(rows[0]);
  }

  async findExchangeById(id: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_exchanges WHERE id = $1`,
      [id],
      client,
    );
    return rows[0] ? this.mapExchange(rows[0]) : null;
  }

  async findExchangeByIdempotencyKey(idempotencyKey: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_exchanges WHERE idempotency_key = $1`,
      [idempotencyKey],
      client,
    );
    return rows[0] ? this.mapExchange(rows[0]) : null;
  }

  async listExchanges(
    filter: {
      endpointId?: string;
      status?: ControlExchangeStatus;
      limit?: number;
      offset?: number;
    },
    client?: unknown,
  ) {
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = filter.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.endpointId) {
      params.push(filter.endpointId);
      where.push(`endpoint_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const wh = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_exchanges ${wh}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
      client,
    );
    return rows.map((r) => this.mapExchange(r));
  }

  async insertExchangeAttempt(row: ControlExchangeAttemptInsert, client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_product_control_exchange_attempts (
         exchange_id, attempt_number, completed_at, outcome, http_status,
         error_classification, duration_ms, request_digest, response_digest, diagnostics
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        row.exchangeId,
        row.attemptNumber,
        row.completedAt ?? new Date(),
        row.outcome,
        row.httpStatus ?? null,
        row.errorClassification ?? null,
        row.durationMs ?? null,
        row.requestDigest ?? null,
        row.responseDigest ?? null,
        JSON.stringify(row.diagnostics ?? {}),
      ],
      client,
    );
  }

  async insertCallback(
    row: Omit<ControlCallbackRecord, 'id' | 'createdAt' | 'receivedAt'> & {
      id?: string;
      receivedAt?: Date;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_callbacks (
         id, endpoint_id, exchange_id, callback_id, correlation_id, request_id,
         received_at, signature_valid, payload, status, rejection_reason, idempotency_key
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,COALESCE($7, NOW()),
         $8,$9::jsonb,$10,$11,$12
       ) RETURNING *`,
      [
        row.id ?? null,
        row.endpointId,
        row.exchangeId,
        row.callbackId,
        row.correlationId,
        row.requestId,
        row.receivedAt ?? null,
        row.signatureValid,
        JSON.stringify(row.payload ?? {}),
        row.status,
        row.rejectionReason,
        row.idempotencyKey,
      ],
      client,
    );
    return this.mapCallback(rows[0]!);
  }

  async findCallbackByIdempotencyKey(idempotencyKey: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_callbacks WHERE idempotency_key = $1`,
      [idempotencyKey],
      client,
    );
    return rows[0] ? this.mapCallback(rows[0]) : null;
  }

  async updateCallbackStatus(
    id: string,
    status: ControlCallbackStatus,
    patch?: Partial<
      Pick<ControlCallbackRecord, 'signatureValid' | 'rejectionReason' | 'exchangeId'>
    >,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_product_control_callbacks SET
         status = $2,
         signature_valid = COALESCE($3, signature_valid),
         rejection_reason = COALESCE($4, rejection_reason),
         exchange_id = COALESCE($5::uuid, exchange_id)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        patch?.signatureValid ?? null,
        patch?.rejectionReason ?? null,
        patch?.exchangeId ?? null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Callback not found', [{ id }]);
    }
    return this.mapCallback(rows[0]);
  }

  async insertHealthCheck(
    row: Omit<ProductControlHealthCheckRecord, 'id' | 'createdAt' | 'checkedAt'> & {
      id?: string;
      checkedAt?: Date;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_health_checks (
         id, endpoint_id, checked_at, result, latency_ms, http_status,
         error_classification, details
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, COALESCE($3, NOW()), $4,$5,$6,$7,$8::jsonb
       ) RETURNING *`,
      [
        row.id ?? null,
        row.endpointId,
        row.checkedAt ?? null,
        row.result,
        row.latencyMs,
        row.httpStatus,
        row.errorClassification,
        JSON.stringify(row.details ?? {}),
      ],
      client,
    );
    return this.mapHealth(rows[0]!);
  }

  async insertReconciliation(
    row: Omit<
      ProductControlReconciliationRecord,
      'id' | 'createdAt' | 'updatedAt' | 'openedAt'
    > & { id?: string; openedAt?: Date },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_reconciliation (
         id, exchange_id, endpoint_id, reason, status, opened_at, resolved_at,
         resolved_by, resolution_notes, details
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,COALESCE($6, NOW()),
         $7,$8,$9,$10::jsonb
       ) RETURNING *`,
      [
        row.id ?? null,
        row.exchangeId,
        row.endpointId,
        row.reason,
        row.status,
        row.openedAt ?? null,
        row.resolvedAt,
        row.resolvedBy,
        row.resolutionNotes,
        JSON.stringify(row.details ?? {}),
      ],
      client,
    );
    return this.mapReconciliation(rows[0]!);
  }

  async updateReconciliation(
    id: string,
    patch: Partial<
      Pick<
        ProductControlReconciliationRecord,
        'status' | 'resolvedAt' | 'resolvedBy' | 'resolutionNotes' | 'details'
      >
    >,
    client?: unknown,
  ) {
    const rows = await this.q(
      `UPDATE edge_p7_product_control_reconciliation SET
         status = COALESCE($2, status),
         resolved_at = COALESCE($3, resolved_at),
         resolved_by = COALESCE($4, resolved_by),
         resolution_notes = COALESCE($5, resolution_notes),
         details = COALESCE($6::jsonb, details),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.status ?? null,
        patch.resolvedAt ?? null,
        patch.resolvedBy ?? null,
        patch.resolutionNotes ?? null,
        patch.details ? JSON.stringify(patch.details) : null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reconciliation not found', [{ id }]);
    }
    return this.mapReconciliation(rows[0]);
  }

  async findOpenReconciliationByExchangeId(exchangeId: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_reconciliation
       WHERE exchange_id = $1 AND status IN ('OPEN','IN_PROGRESS')
       ORDER BY opened_at DESC LIMIT 1`,
      [exchangeId],
      client,
    );
    return rows[0] ? this.mapReconciliation(rows[0]) : null;
  }

  async upsertCredentialBinding(
    row: Omit<CredentialBindingRecord, 'id' | 'createdAt' | 'updatedAt' | 'boundAt'> & {
      id?: string;
      boundAt?: Date;
    },
    client?: unknown,
  ) {
    const rows = await this.q(
      `INSERT INTO edge_p7_product_control_credential_bindings (
         id, endpoint_id, credential_ref, auth_profile, status, bound_at,
         expires_at, revoked_at, revoked_by, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,COALESCE($6, NOW()),
         $7,$8,$9,$10::jsonb
       )
       ON CONFLICT (endpoint_id, credential_ref) DO UPDATE SET
         auth_profile = EXCLUDED.auth_profile,
         status = EXCLUDED.status,
         expires_at = EXCLUDED.expires_at,
         revoked_at = EXCLUDED.revoked_at,
         revoked_by = EXCLUDED.revoked_by,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        row.id ?? null,
        row.endpointId,
        row.credentialRef,
        row.authProfile,
        row.status,
        row.boundAt ?? null,
        row.expiresAt,
        row.revokedAt,
        row.revokedBy,
        JSON.stringify(row.metadata ?? {}),
      ],
      client,
    );
    return this.mapCredential(rows[0]!);
  }

  async findCredentialBinding(endpointId: string, credentialRef: string, client?: unknown) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_product_control_credential_bindings
       WHERE endpoint_id = $1 AND credential_ref = $2`,
      [endpointId, credentialRef],
      client,
    );
    return rows[0] ? this.mapCredential(rows[0]) : null;
  }

  async insertHistory(row: ProductControlHistoryInsert, client?: unknown) {
    await this.q(
      `INSERT INTO edge_p7_product_control_history (
         resource_type, resource_id, from_status, to_status, action, reason, actor_id, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        row.resourceType,
        row.resourceId,
        row.fromStatus,
        row.toStatus,
        row.action,
        row.reason,
        row.actorId,
        JSON.stringify(row.details ?? {}),
      ],
      client,
    );
  }
}
