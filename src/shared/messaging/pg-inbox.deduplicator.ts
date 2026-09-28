import { Injectable } from '@nestjs/common';
import { TenantDatabaseManager } from '../database/tenant-database.manager.js';
import type { InboxDeduplicatorPort } from '../../core/domain/ports/inbox.port.js';

@Injectable()
export class PgInboxDeduplicator implements InboxDeduplicatorPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async tryClaim(tenantId: string, messageId: string, consumerId: string): Promise<boolean> {
    const pool = await this.dbManager.getPool(tenantId);
    const result = await pool.query(
      `INSERT INTO inbox_messages (message_id, consumer_id, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (message_id, consumer_id) DO NOTHING
       RETURNING message_id`,
      [messageId, consumerId],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async releaseClaim(tenantId: string, messageId: string, consumerId: string): Promise<void> {
    const pool = await this.dbManager.getPool(tenantId);
    await pool.query(
      `DELETE FROM inbox_messages WHERE message_id = $1 AND consumer_id = $2`,
      [messageId, consumerId],
    );
  }
}
