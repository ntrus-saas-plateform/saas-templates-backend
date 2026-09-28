import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import type { AuditWriterPort } from '../../core/domain/ports/audit.port.js';
import type { AuditEvent } from '../../core/domain/audit/audit-event.js';
import { sanitizeForAudit } from '../security/sanitize.js';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

@Injectable()
export class PgAuditWriter implements AuditWriterPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async write(event: AuditEvent): Promise<void> {
    const pool = this.dbManager.getControlPlanePool();
    const id = event.id || randomUUID();
    const beforeState = sanitizeForAudit(event.before);
    const afterState = sanitizeForAudit(event.after);
    const metadata = sanitizeForAudit(event.metadata) ?? {};

    // Tamper-evident chain when prev_hash/row_hash columns exist (req 49)
    let prevHash: string | null = null;
    let rowHash: string | null = null;
    const device =
      typeof metadata === 'object' && metadata && 'device' in metadata
        ? String((metadata as Record<string, unknown>).device ?? '')
        : null;
    const reason =
      typeof metadata === 'object' && metadata && 'reason' in metadata
        ? String((metadata as Record<string, unknown>).reason ?? '')
        : null;

    try {
      const prev = await pool.query<{ row_hash: string | null }>(
        `SELECT row_hash FROM audit_logs
         WHERE tenant_id = $1
         ORDER BY timestamp DESC NULLS LAST
         LIMIT 1`,
        [event.tenantId],
      );
      prevHash = prev.rows[0]?.row_hash ?? 'GENESIS';
      const payload = JSON.stringify({
        id,
        tenantId: event.tenantId,
        organizationId: event.organizationId,
        actorId: event.actorId,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        status: event.status,
        timestamp: event.timestamp,
        requestId: event.requestId,
        before: beforeState,
        after: afterState,
        metadata,
      });
      rowHash = sha256Hex(`${prevHash}|${payload}`);
    } catch {
      // Columns or table shape may predate migration — fall through without hash
      prevHash = null;
      rowHash = null;
    }

    try {
      await pool.query(
        `INSERT INTO audit_logs
          (id, tenant_id, organization_id, actor_id, actor_type, action, resource,
           resource_id, status, timestamp, correlation_id, request_id, ip, user_agent,
           before_state, after_state, metadata, prev_hash, row_hash, device, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [
          id,
          event.tenantId,
          event.organizationId,
          event.actorId,
          event.actorType,
          event.action,
          event.resource,
          event.resourceId,
          event.status,
          event.timestamp,
          event.correlationId,
          event.requestId,
          event.ip,
          event.userAgent,
          JSON.stringify(beforeState),
          JSON.stringify(afterState),
          JSON.stringify(metadata),
          prevHash,
          rowHash,
          device || null,
          reason || null,
        ],
      );
    } catch {
      // Fallback without hash columns (pre-migration control plane)
      await pool.query(
        `INSERT INTO audit_logs
          (id, tenant_id, organization_id, actor_id, actor_type, action, resource,
           resource_id, status, timestamp, correlation_id, request_id, ip, user_agent,
           before_state, after_state, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          id,
          event.tenantId,
          event.organizationId,
          event.actorId,
          event.actorType,
          event.action,
          event.resource,
          event.resourceId,
          event.status,
          event.timestamp,
          event.correlationId,
          event.requestId,
          event.ip,
          event.userAgent,
          JSON.stringify(beforeState),
          JSON.stringify(afterState),
          JSON.stringify(metadata),
        ],
      );
    }
  }
}
