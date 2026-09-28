import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantDatabaseManager } from './tenant-database.manager.js';
import type { ControlPlaneTransactionManagerPort } from '../../core/domain/ports/control-plane-transaction-manager.port.js';

@Injectable()
export class PgControlPlaneTransactionManager implements ControlPlaneTransactionManagerPort {
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
