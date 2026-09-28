import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type { ControlPlaneTransactionPort } from '../../domain/ports/control-plane-transaction.port.js';

@Injectable()
export class PgControlPlaneTransactionManager implements ControlPlaneTransactionPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  async runInTransaction<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
    const client = await this.dbManager.getControlPlanePool().connect();
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
