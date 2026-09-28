import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolConfig } from 'pg';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { CircuitBreaker } from '../security/resilience.js';

/**
 * Control-plane PostgreSQL pool — isolated from TenantDatabaseManager to avoid
 * a circular dependency with PgTenantRegistry (registry reads control plane only).
 */
@Injectable()
export class ControlPlaneDatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly breaker: CircuitBreaker;

  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {
    this.breaker = new CircuitBreaker(
      this.config.CIRCUIT_BREAKER_THRESHOLD,
      this.config.CIRCUIT_BREAKER_RESET_MS,
    );
    this.pool = new Pool(this.buildConfig());
  }

  getPool(): Pool {
    return this.pool;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.breaker.execute(async () => {
        await this.pool.query('SELECT 1');
      });
      return true;
    } catch {
      return false;
    }
  }

  private buildSslConfig(): PoolConfig['ssl'] {
    if (!this.config.CONTROL_PLANE_DB_SSL) return undefined;
    return { rejectUnauthorized: this.config.CONTROL_PLANE_DB_SSL_REJECT_UNAUTHORIZED };
  }

  private buildConfig(): PoolConfig {
    return {
      host: this.config.CONTROL_PLANE_DB_HOST,
      port: this.config.CONTROL_PLANE_DB_PORT,
      database: this.config.CONTROL_PLANE_DB_NAME,
      user: this.config.CONTROL_PLANE_DB_USER,
      password: this.config.CONTROL_PLANE_DB_PASSWORD,
      max: this.config.DB_POOL_MAX,
      idleTimeoutMillis: this.config.DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: this.config.DB_POOL_CONNECTION_TIMEOUT_MS,
      statement_timeout: this.config.DB_STATEMENT_TIMEOUT_MS,
      ssl: this.buildSslConfig(),
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
