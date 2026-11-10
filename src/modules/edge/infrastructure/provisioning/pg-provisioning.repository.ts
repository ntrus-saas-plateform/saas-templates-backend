import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ProvisioningRequestProps } from '../../domain/provisioning/provisioning-request.entity.js';
import {
  assertProvisioningRequestTransition,
} from '../../domain/provisioning/provisioning-request.entity.js';
import type {
  ListProvisioningRequestsFilter,
  ProvisioningRepositoryPort,
  ProvisioningRequestHistoryEntry,
  ProvisioningRequestStats,
  StoredProvisioningAuthorization,
} from '../../domain/provisioning/provisioning-repository.port.js';
import {
  ProvisioningRequestStatus,
} from '../../domain/provisioning/provisioning.types.js';
import type { CanonicalProvisioningAuthorization } from '../../domain/provisioning/provisioning.types.js';

@Injectable()
export class PgProvisioningRepository implements ProvisioningRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  private async q<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  private mapAuth(r: Record<string, unknown>): StoredProvisioningAuthorization {
    return {
      id: String(r.id),
      authorizationId: String(r.authorization_id),
      authorizationVersion: Number(r.authorization_version),
      schemaVersion: String(r.schema_version),
      authorizationType: String(r.authorization_type),
      operation: String(r.operation),
      accountId: String(r.account_id),
      subscriptionId: String(r.subscription_id),
      productId: String(r.product_id),
      productTenantId: (r.product_tenant_id as string | null) ?? null,
      correlationId: String(r.correlation_id),
      causationId: (r.causation_id as string | null) ?? null,
      idempotencyKey: String(r.idempotency_key),
      decision: String(r.decision),
      authorizationStatus: String(r.authorization_status),
      decisionReasonCode: (r.decision_reason_code as string | null) ?? null,
      decisionTimestamp: new Date(String(r.decision_timestamp)),
      issuedAt: new Date(String(r.issued_at)),
      notBefore: r.not_before ? new Date(String(r.not_before)) : null,
      expiresAt: r.expires_at ? new Date(String(r.expires_at)) : null,
      entitlementSnapshotReference: String(r.entitlement_snapshot_reference),
      entitlementVersion: String(r.entitlement_version),
      issuer: String(r.issuer),
      audience: String(r.audience),
      keyId: String(r.key_id),
      signatureAlgorithm: String(r.signature_algorithm),
      payloadDigest: String(r.payload_digest),
      signaturePresent: Boolean(r.signature_present),
      issuedByServiceIdentity: String(r.issued_by_service_identity),
      revocationStatus: String(r.revocation_status),
      revocationVersion: r.revocation_version == null ? null : Number(r.revocation_version),
      revokedAt: r.revoked_at ? new Date(String(r.revoked_at)) : null,
      revocationReasonCode: (r.revocation_reason_code as string | null) ?? null,
      revocationReference: (r.revocation_reference as string | null) ?? null,
      environmentSlot: String(r.environment_slot),
      verificationStatus: String(r.verification_status),
      verificationReasonCode: (r.verification_reason_code as string | null) ?? null,
      verifiedAt: r.verified_at ? new Date(String(r.verified_at)) : null,
      payloadSnapshot: (r.payload_snapshot as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapRequest(r: Record<string, unknown>): ProvisioningRequestProps {
    return {
      id: String(r.id),
      requestNumber: String(r.request_number),
      authorizationId: String(r.authorization_id),
      authorizationVersion: Number(r.authorization_version),
      authorizationRowId: (r.authorization_row_id as string | null) ?? null,
      operation: String(r.operation),
      accountId: String(r.account_id),
      productId: String(r.product_id),
      subscriptionId: String(r.subscription_id),
      productTenantId: (r.product_tenant_id as string | null) ?? null,
      correlationId: String(r.correlation_id),
      causationId: (r.causation_id as string | null) ?? null,
      requestStatus: String(r.request_status) as ProvisioningRequestStatus,
      environmentSlot: String(r.environment_slot) as ProvisioningRequestProps['environmentSlot'],
      idempotencyKey: String(r.idempotency_key),
      deduplicationReference: (r.deduplication_reference as string | null) ?? null,
      payloadDigest: (r.payload_digest as string | null) ?? null,
      entitlementSnapshotReference: (r.entitlement_snapshot_reference as string | null) ?? null,
      policyVersion: (r.policy_version as string | null) ?? null,
      rejectionReasonCode: (r.rejection_reason_code as string | null) ?? null,
      cancellationReason: (r.cancellation_reason as string | null) ?? null,
      source: String(r.source),
      createdBy: (r.created_by as string | null) ?? null,
      lastActor: (r.last_actor as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      receivedAt: new Date(String(r.received_at)),
      acceptedAt: r.accepted_at ? new Date(String(r.accepted_at)) : null,
      rejectedAt: r.rejected_at ? new Date(String(r.rejected_at)) : null,
      cancelledAt: r.cancelled_at ? new Date(String(r.cancelled_at)) : null,
      failedAt: r.failed_at ? new Date(String(r.failed_at)) : null,
      lastTransitionAt: new Date(String(r.last_transition_at)),
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async upsertAuthorization(input: {
    auth: CanonicalProvisioningAuthorization;
    environmentSlot: string;
    verificationStatus: string;
    verificationReasonCode: string | null;
    verifiedAt: Date | null;
    signaturePresent: boolean;
  }): Promise<StoredProvisioningAuthorization> {
    const a = input.auth;
    const rows = await this.q(
      `INSERT INTO edge_provisioning_authorizations (
         authorization_id, authorization_version, schema_version, authorization_type, operation,
         account_id, subscription_id, product_id, product_tenant_id, correlation_id, causation_id,
         idempotency_key, decision, authorization_status, decision_reason_code, decision_timestamp,
         issued_at, not_before, expires_at, entitlement_snapshot_reference, entitlement_version,
         subscription_version, commercial_policy_version, contract_reference, billing_evaluation_reference,
         issuer, audience, key_id, signature_algorithm, payload_digest, signature_present,
         issued_by_service_identity, revocation_status, revocation_version, revoked_at,
         revocation_reason_code, revocation_reference, environment_slot, verification_status,
         verification_reason_code, verified_at, payload_snapshot
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
         $26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42::jsonb
       )
       ON CONFLICT (authorization_id, authorization_version) DO UPDATE SET
         verification_status = EXCLUDED.verification_status,
         verification_reason_code = EXCLUDED.verification_reason_code,
         verified_at = EXCLUDED.verified_at,
         authorization_status = EXCLUDED.authorization_status,
         revocation_status = EXCLUDED.revocation_status,
         updated_at = NOW()
       RETURNING *`,
      [
        a.authorization_id,
        a.authorization_version,
        a.schema_version,
        a.authorization_type,
        a.operation,
        a.account_id,
        a.subscription_id,
        a.product_id,
        a.product_tenant_id ?? null,
        a.correlation_id,
        a.causation_id ?? null,
        a.idempotency_key,
        a.decision,
        a.authorization_status,
        a.decision_reason_code ?? null,
        a.decision_timestamp,
        a.issued_at,
        a.not_before ?? null,
        a.expires_at ?? null,
        a.entitlement_snapshot_reference,
        a.entitlement_version,
        a.subscription_version ?? null,
        a.commercial_policy_version ?? null,
        a.contract_reference ?? null,
        a.billing_evaluation_reference ?? null,
        a.issuer,
        a.audience,
        a.key_id,
        a.signature_algorithm,
        a.payload_digest,
        input.signaturePresent,
        a.issued_by_service_identity,
        a.revocation_status,
        a.revocation_version ?? null,
        a.revoked_at ?? null,
        a.revocation_reason_code ?? null,
        a.revocation_reference ?? null,
        input.environmentSlot,
        input.verificationStatus,
        input.verificationReasonCode,
        input.verifiedAt,
        JSON.stringify(sanitizeAuthSnapshot(a)),
      ],
    );
    return this.mapAuth(rows[0]!);
  }

  async getAuthorizationByVersion(authorizationId: string, authorizationVersion: number) {
    const rows = await this.q(
      `SELECT * FROM edge_provisioning_authorizations
       WHERE authorization_id = $1 AND authorization_version = $2`,
      [authorizationId, authorizationVersion],
    );
    return rows[0] ? this.mapAuth(rows[0]) : null;
  }

  async getAuthorizationById(id: string) {
    const rows = await this.q(`SELECT * FROM edge_provisioning_authorizations WHERE id = $1`, [id]);
    return rows[0] ? this.mapAuth(rows[0]) : null;
  }

  async markAuthorizationRevoked(input: {
    authorizationId: string;
    revocationVersion: number;
    revokedAt: Date;
    reasonCode: string | null;
    reference: string | null;
  }) {
    const rows = await this.q(
      `UPDATE edge_provisioning_authorizations SET
         revocation_status = 'REVOKED',
         authorization_status = 'REVOKED',
         verification_status = 'REVOKED',
         revocation_version = GREATEST(COALESCE(revocation_version, 0), $2),
         revoked_at = COALESCE(revoked_at, $3),
         revocation_reason_code = COALESCE($4, revocation_reason_code),
         revocation_reference = COALESCE($5, revocation_reference),
         updated_at = NOW()
       WHERE authorization_id = $1
         AND (revocation_version IS NULL OR revocation_version <= $2)
       RETURNING *`,
      [
        input.authorizationId,
        input.revocationVersion,
        input.revokedAt,
        input.reasonCode,
        input.reference,
      ],
    );
    return rows[0] ? this.mapAuth(rows[0]) : null;
  }

  async findRequestByAuthOpVersion(
    authorizationId: string,
    operation: string,
    authorizationVersion: number,
  ) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_provisioning_requests
       WHERE authorization_id = $1 AND operation = $2 AND authorization_version = $3`,
      [authorizationId, operation, authorizationVersion],
    );
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async findRequestByIdempotencyKey(key: string) {
    const rows = await this.q(
      `SELECT * FROM edge_p7_provisioning_requests WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async getRequestById(id: string) {
    const rows = await this.q(`SELECT * FROM edge_p7_provisioning_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async createRequest(input: Parameters<ProvisioningRepositoryPort['createRequest']>[0]) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const insert = await client.query(
        `INSERT INTO edge_p7_provisioning_requests (
           request_number, authorization_id, authorization_version, authorization_row_id, operation,
           account_id, product_id, subscription_id, product_tenant_id, correlation_id, causation_id,
           request_status, environment_slot, idempotency_key, deduplication_reference, payload_digest,
           entitlement_snapshot_reference, policy_version, rejection_reason_code, source,
           created_by, last_actor, metadata, accepted_at, rejected_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24,$25
         )
         RETURNING *`,
        [
          input.requestNumber,
          input.authorizationId,
          input.authorizationVersion,
          input.authorizationRowId,
          input.operation,
          input.accountId,
          input.productId,
          input.subscriptionId,
          input.productTenantId,
          input.correlationId,
          input.causationId,
          input.requestStatus,
          input.environmentSlot,
          input.idempotencyKey,
          input.deduplicationReference,
          input.payloadDigest,
          input.entitlementSnapshotReference,
          input.policyVersion,
          input.rejectionReasonCode,
          input.source,
          input.createdBy,
          input.lastActor,
          JSON.stringify(input.metadata ?? {}),
          input.acceptedAt ?? null,
          input.rejectedAt ?? null,
        ],
      );
      const row = insert.rows[0] as Record<string, unknown>;
      await client.query(
        `INSERT INTO edge_p7_provisioning_request_history (
           request_id, previous_status, new_status, actor_type, actor_id, source, reason_code,
           correlation_id, causation_id, metadata
         ) VALUES ($1, NULL, $2, 'SYSTEM', $3, $4, $5, $6, $7, '{}'::jsonb)`,
        [
          row.id,
          input.requestStatus,
          input.createdBy,
          input.source,
          input.rejectionReasonCode,
          input.correlationId,
          input.causationId,
        ],
      );
      await client.query('COMMIT');
      return this.mapRequest(row);
    } catch (err) {
      await client.query('ROLLBACK');
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        throw new DomainError(
          ErrorCode.IDEMPOTENCY_CONFLICT,
          'Duplicate provisioning request for authorization/operation/version or idempotency key',
        );
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async transitionRequest(input: Parameters<ProvisioningRepositoryPort['transitionRequest']>[0]) {
    assertProvisioningRequestTransition(input.fromStatus, input.toStatus);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const sets: string[] = [
        `request_status = $2`,
        `last_actor = $3`,
        `last_transition_at = NOW()`,
        `updated_at = NOW()`,
      ];
      const params: unknown[] = [input.id, input.toStatus, input.actorId];
      let idx = 4;
      if (input.toStatus === ProvisioningRequestStatus.ACCEPTED) {
        sets.push(`accepted_at = COALESCE(accepted_at, NOW())`);
      }
      if (input.toStatus === ProvisioningRequestStatus.REJECTED) {
        sets.push(`rejected_at = COALESCE(rejected_at, NOW())`);
        sets.push(`rejection_reason_code = $${idx++}`);
        params.push(input.reasonCode);
      }
      if (input.toStatus === ProvisioningRequestStatus.CANCELLED) {
        sets.push(`cancelled_at = COALESCE(cancelled_at, NOW())`);
        sets.push(`cancellation_reason = $${idx++}`);
        params.push(input.cancellationReason ?? input.reasonCode);
      }
      if (input.toStatus === ProvisioningRequestStatus.FAILED) {
        sets.push(`failed_at = COALESCE(failed_at, NOW())`);
        sets.push(`rejection_reason_code = COALESCE($${idx++}, rejection_reason_code)`);
        params.push(input.reasonCode);
      }
      const updated = await client.query(
        `UPDATE edge_p7_provisioning_requests
         SET ${sets.join(', ')}
         WHERE id = $1 AND request_status = $${idx}
         RETURNING *`,
        [...params, input.fromStatus],
      );
      if (!updated.rows[0]) {
        await client.query('ROLLBACK');
        throw new DomainError(
          ErrorCode.CONFLICT,
          'Concurrent provisioning request state conflict',
          [{ id: input.id, from: input.fromStatus, to: input.toStatus }],
        );
      }
      await client.query(
        `INSERT INTO edge_p7_provisioning_request_history (
           request_id, previous_status, new_status, actor_type, actor_id, source, reason_code,
           correlation_id, causation_id, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          input.id,
          input.fromStatus,
          input.toStatus,
          input.actorType,
          input.actorId,
          input.source,
          input.reasonCode,
          input.correlationId,
          input.causationId,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      await client.query('COMMIT');
      return this.mapRequest(updated.rows[0] as Record<string, unknown>);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async listRequests(filter: ListProvisioningRequestsFilter) {
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    let i = 1;
    if (filter.status) {
      where.push(`request_status = $${i++}`);
      params.push(filter.status);
    }
    if (filter.accountId) {
      where.push(`account_id = $${i++}`);
      params.push(filter.accountId);
    }
    if (filter.productId) {
      where.push(`product_id = $${i++}`);
      params.push(filter.productId);
    }
    if (filter.subscriptionId) {
      where.push(`subscription_id = $${i++}`);
      params.push(filter.subscriptionId);
    }
    if (filter.environmentSlot) {
      where.push(`environment_slot = $${i++}`);
      params.push(filter.environmentSlot);
    }
    if (filter.from) {
      where.push(`received_at >= $${i++}`);
      params.push(filter.from);
    }
    if (filter.to) {
      where.push(`received_at <= $${i++}`);
      params.push(filter.to);
    }
    const whereSql = where.join(' AND ');
    const countRows = await this.q<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_p7_provisioning_requests WHERE ${whereSql}`,
      params,
    );
    const limit = Math.min(Math.max(filter.limit, 1), 100);
    const offset = Math.max(filter.offset, 0);
    const rows = await this.q(
      `SELECT * FROM edge_p7_provisioning_requests
       WHERE ${whereSql}
       ORDER BY received_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset],
    );
    return {
      items: rows.map((r) => this.mapRequest(r)),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async listRequestHistory(requestId: string): Promise<ProvisioningRequestHistoryEntry[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_provisioning_request_history
       WHERE request_id = $1 ORDER BY occurred_at ASC`,
      [requestId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      requestId: String(r.request_id),
      previousStatus: (r.previous_status as string | null) ?? null,
      newStatus: String(r.new_status),
      actorType: String(r.actor_type),
      actorId: (r.actor_id as string | null) ?? null,
      source: String(r.source),
      reasonCode: (r.reason_code as string | null) ?? null,
      occurredAt: new Date(String(r.occurred_at)),
      correlationId: (r.correlation_id as string | null) ?? null,
      causationId: (r.causation_id as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));
  }

  async getRequestStats(): Promise<ProvisioningRequestStats> {
    const rows = await this.q<{ request_status: string; count: string }>(
      `SELECT request_status, COUNT(*)::text AS count
       FROM edge_p7_provisioning_requests
       GROUP BY request_status`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.request_status, Number(r.count)]));
    const requested = by.REQUESTED ?? 0;
    const accepted = by.ACCEPTED ?? 0;
    const rejected = by.REJECTED ?? 0;
    const cancelled = by.CANCELLED ?? 0;
    const failed = by.FAILED ?? 0;
    return {
      total: requested + accepted + rejected + cancelled + failed,
      requested,
      accepted,
      rejected,
      cancelled,
      failed,
    };
  }

  async recordRevocationInbox(input: {
    eventId: string;
    authorizationId: string;
    revocationVersion: number;
    eventName: string;
    payload: Record<string, unknown>;
    outcome: string;
    rejectionReason: string | null;
  }) {
    try {
      await this.q(
        `INSERT INTO edge_p7_authorization_revocation_inbox (
           event_id, authorization_id, revocation_version, event_name, payload, outcome, rejection_reason
         ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [
          input.eventId,
          input.authorizationId,
          input.revocationVersion,
          input.eventName,
          JSON.stringify(input.payload),
          input.outcome,
          input.rejectionReason,
        ],
      );
      return { duplicate: false };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') return { duplicate: true };
      throw err;
    }
  }
}

function sanitizeAuthSnapshot(auth: CanonicalProvisioningAuthorization): Record<string, unknown> {
  const { signature, ...rest } = auth;
  return { ...rest, signature: signature ? '[REDACTED]' : null };
}
