import { Injectable, Logger } from '@nestjs/common';
import type { PlatformAdminAuditPort, PlatformAdminAuditRecord } from '../../domain/ports/platform-admin-audit.port.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';

@Injectable()
export class PgPlatformAdminAuditRepository implements PlatformAdminAuditPort {
  private readonly logger = new Logger(PgPlatformAdminAuditRepository.name);

  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  async record(entry: PlatformAdminAuditRecord): Promise<void> {
    try {
      await this.controlPlaneDatabase.getPool().query(
        `INSERT INTO platform_admin_audit_log
          (actor_identity_id, actor_client_id, action, resource_type, resource_id,
           tenant_id, request_id, ip, user_agent, result, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          entry.actorIdentityId ?? null,
          entry.actorClientId ?? null,
          entry.action,
          entry.resourceType,
          entry.resourceId ?? null,
          entry.tenantId ?? null,
          entry.requestId ?? null,
          entry.ip ?? null,
          entry.userAgent ?? null,
          entry.result,
          JSON.stringify(entry.metadata ?? {}),
        ],
      );
    } catch (err) {
      this.logger.error('Failed to write platform admin audit log entry', err);
    }
  }
}
