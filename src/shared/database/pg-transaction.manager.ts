import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from './tenant-database.manager.js';
import type { TransactionManagerPort } from '../../core/domain/ports/transaction-manager.port.js';

@Injectable()
export class PgTransactionManager implements TransactionManagerPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async runInTransaction<T>(tenantId: string, fn: (client: unknown) => Promise<T>): Promise<T> {
    const client = await this.dbManager.getClient(tenantId);
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export { type PoolClient };
